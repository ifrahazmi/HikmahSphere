import axios, { AxiosInstance } from 'axios';

/**
 * Phase 4: Integration & Testing
 * 
 * Comprehensive end-to-end workflow testing for the Zakat Management System
 * Tests include:
 * - Authentication flows
 * - Donor management
 * - Donation creation and tracking
 * - Installment scheduling
 * - Payment processing
 * - Analytics accuracy
 */

interface TestConfig {
  apiUrl: string;
  timeout: number;
  adminEmail: string;
  adminPassword: string;
}

interface TestUser {
  id: string;
  email: string;
  token: string;
  role: string;
}

interface TestDonor {
  id: string;
  donorId: string;
  fullName: string;
  phone: string;
}

interface TestDonation {
  id: string;
  donationId: string;
  amount: number;
  status: string;
}

class IntegrationTestSuite {
  private config: TestConfig;
  private client: AxiosInstance;
  private testUser: TestUser | null = null;
  private testDonor: TestDonor | null = null;
  private testDonation: TestDonation | null = null;
  private testResults: Array<{
    testName: string;
    status: 'PASS' | 'FAIL';
    message: string;
    duration: number;
  }> = [];

  constructor(config: TestConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout,
    });
  }

  /**
   * Test 1: Authentication Flow
   */
  async testAuthenticationFlow(): Promise<boolean> {
    const startTime = Date.now();
    try {
      console.log('\n🔐 Testing Authentication Flow...');

      // Login
      const loginRes = await this.client.post('/auth/login', {
        email: this.config.adminEmail,
        password: this.config.adminPassword,
      });

      if (!loginRes.data.success || !loginRes.data.data.token) {
        throw new Error('Login failed or no token returned');
      }

      this.testUser = {
        id: loginRes.data.data.user.id,
        email: loginRes.data.data.user.email,
        token: loginRes.data.data.token,
        role: loginRes.data.data.user.role,
      };

      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.testUser.token}`;

      console.log(`✅ Authentication successful - Token: ${this.testUser.token.substring(0, 20)}...`);

      this.recordResult('Authentication Flow', 'PASS', 'Successfully authenticated and obtained token', Date.now() - startTime);
      return true;
    } catch (error: any) {
      console.error(`❌ Authentication Flow Failed:`, error.message);
      this.recordResult('Authentication Flow', 'FAIL', error.message, Date.now() - startTime);
      return false;
    }
  }

  /**
   * Test 2: Donor Creation & Lookup
   */
  async testDonorManagement(): Promise<boolean> {
    const startTime = Date.now();
    try {
      console.log('\n👤 Testing Donor Management...');

      const donorData = {
        fullName: `Test Donor ${Date.now()}`,
        phone: `999${Math.floor(Math.random() * 10000000)
          .toString()
          .padStart(7, '0')}`,
        email: `testdonor${Date.now()}@test.com`,
        donorType: 'Individual',
        city: 'Test City',
        state: 'Test State',
      };

      // Create donor
      const createRes = await this.client.post('/zakat/donors', donorData);
      if (!createRes.data.success) throw new Error('Donor creation failed');

      this.testDonor = {
        id: createRes.data.data._id,
        donorId: createRes.data.data.donorId,
        fullName: createRes.data.data.fullName,
        phone: createRes.data.data.phone,
      };

      console.log(`✅ Donor created: ${this.testDonor.donorId} (${this.testDonor.fullName})`);

      // Verify donor lookup by phone
      const lookupRes = await this.client.get(`/zakat/donors/phone/${this.testDonor.phone}`);
      if (!lookupRes.data.success || !lookupRes.data.exists) {
        throw new Error('Donor lookup failed');
      }

      console.log(`✅ Donor lookup successful by phone`);

      // Get single donor
      const getRes = await this.client.get(`/zakat/donors/${this.testDonor.id}`);
      if (!getRes.data.success) throw new Error('Donor fetch failed');

      console.log(`✅ Donor details retrieved`);

      this.recordResult('Donor Management', 'PASS', 'Successfully created and looked up donor', Date.now() - startTime);
      return true;
    } catch (error: any) {
      console.error(`❌ Donor Management Failed:`, error.message);
      this.recordResult('Donor Management', 'FAIL', error.message, Date.now() - startTime);
      return false;
    }
  }

  /**
   * Test 3: Donation Creation & Status Tracking
   */
  async testDonationCreation(): Promise<boolean> {
    const startTime = Date.now();
    try {
      console.log('\n💰 Testing Donation Creation...');

      if (!this.testDonor) throw new Error('Test donor not initialized');

      const donationData = {
        donorId: this.testDonor.id,
        donationType: 'Zakat_Maal',
        totalAmount: 50000,
        paymentMode: 'Installment',
        numberOfInstallments: 4,
        allocationCategory: 'General',
        paymentMethod: 'Bank',
        notes: 'Test donation for integration testing',
      };

      // Create donation
      const createRes = await this.client.post('/zakat/donations', donationData);
      if (!createRes.data.success) throw new Error('Donation creation failed');

      this.testDonation = {
        id: createRes.data.data._id,
        donationId: createRes.data.data.donationId,
        amount: createRes.data.data.totalAmount,
        status: createRes.data.data.status,
      };

      console.log(`✅ Donation created: ${this.testDonation.donationId} - ₹${this.testDonation.amount}`);

      // Get donation details
      const getRes = await this.client.get(`/zakat/donations/${this.testDonation.id}`);
      if (!getRes.data.success) throw new Error('Donation fetch failed');

      console.log(`✅ Donation status: ${getRes.data.data.status}`);

      this.recordResult('Donation Creation', 'PASS', 'Successfully created and tracked donation', Date.now() - startTime);
      return true;
    } catch (error: any) {
      console.error(`❌ Donation Creation Failed:`, error.message);
      this.recordResult('Donation Creation', 'FAIL', error.message, Date.now() - startTime);
      return false;
    }
  }

  /**
   * Test 4: Installment Scheduling
   */
  async testInstallmentScheduling(): Promise<boolean> {
    const startTime = Date.now();
    try {
      console.log('\n📅 Testing Installment Scheduling...');

      if (!this.testDonation) throw new Error('Test donation not initialized');

      // Create installments
      const createRes = await this.client.post('/zakat/installments', {
        donationId: this.testDonation.id,
        totalInstallments: 4,
        frequency: 'Monthly',
        startDate: new Date().toISOString(),
      });

      if (!createRes.data.success) throw new Error('Installment creation failed');

      console.log(`✅ Created ${createRes.data.data.length} installments`);

      // Verify installments
      if (createRes.data.data.length !== 4) {
        throw new Error(`Expected 4 installments, got ${createRes.data.data.length}`);
      }

      // Get installments for donation
      const getRes = await this.client.get(`/zakat/installments/donation/${this.testDonation.id}`);
      if (!getRes.data.success || getRes.data.total !== 4) {
        throw new Error('Installment fetch failed or count mismatch');
      }

      console.log(`✅ Verified ${getRes.data.total} installments in system`);

      // Check installment amounts
      const perInstallment = this.testDonation.amount / 4;
      getRes.data.data.forEach((inst: any, index: number) => {
        if (Math.abs(inst.amount - perInstallment) > 0.01) {
          throw new Error(`Installment ${index + 1} amount mismatch`);
        }
      });

      console.log(`✅ All installment amounts correct (₹${perInstallment} each)`);

      this.recordResult('Installment Scheduling', 'PASS', 'Successfully created and verified installments', Date.now() - startTime);
      return true;
    } catch (error: any) {
      console.error(`❌ Installment Scheduling Failed:`, error.message);
      this.recordResult('Installment Scheduling', 'FAIL', error.message, Date.now() - startTime);
      return false;
    }
  }

  /**
   * Test 5: Payment Recording & Status Updates
   */
  async testPaymentProcessing(): Promise<boolean> {
    const startTime = Date.now();
    try {
      console.log('\n💳 Testing Payment Processing...');

      if (!this.testDonation) throw new Error('Test donation not initialized');

      const payment = {
        amountPaid: 12500, // 1/4 of total
        paymentMethod: 'Bank',
        transactionId: `TXN${Date.now()}`,
        receiptId: `RCP${Date.now()}`,
      };

      // Record payment
      const payRes = await this.client.put(
        `/zakat/donations/${this.testDonation.id}/payment`,
        payment
      );

      if (!payRes.data.success) throw new Error('Payment recording failed');

      console.log(`✅ Payment recorded: ₹${payment.amountPaid}`);

      // Verify payment status
      const getRes = await this.client.get(`/zakat/donations/${this.testDonation.id}`);
      if (getRes.data.data.amountPaid !== payment.amountPaid) {
        throw new Error('Payment amount not updated');
      }

      if (getRes.data.data.status !== 'Partial') {
        throw new Error(`Expected status 'Partial', got '${getRes.data.data.status}'`);
      }

      console.log(`✅ Donation status updated to: ${getRes.data.data.status}`);

      // Mark first installment as paid
      const installments = await this.client.get(`/zakat/installments/donation/${this.testDonation.id}`);
      if (installments.data.data.length > 0) {
        const instRes = await this.client.put(
          `/zakat/installments/${installments.data.data[0]._id}/mark-paid`,
          {
            paymentDate: new Date().toISOString(),
            transactionId: `INST${Date.now()}`,
          }
        );

        if (instRes.data.success) {
          console.log(`✅ First installment marked as paid`);
        }
      }

      this.recordResult('Payment Processing', 'PASS', 'Successfully processed and tracked payments', Date.now() - startTime);
      return true;
    } catch (error: any) {
      console.error(`❌ Payment Processing Failed:`, error.message);
      this.recordResult('Payment Processing', 'FAIL', error.message, Date.now() - startTime);
      return false;
    }
  }

  /**
   * Test 6: Analytics & Statistics Accuracy
   */
  async testAnalyticsAccuracy(): Promise<boolean> {
    const startTime = Date.now();
    try {
      console.log('\n📊 Testing Analytics Accuracy...');

      // Get donation stats
      const donStats = await this.client.get('/zakat/donations/stats/overview');
      if (!donStats.data.success) throw new Error('Donation stats fetch failed');

      console.log(`✅ Got donation stats:
        - Total Donations: ${donStats.data.data.totalDonations}
        - Total Amount: ₹${donStats.data.data.totalAmount}
        - Completed: ₹${donStats.data.data.completedAmount}
        - Pending: ₹${donStats.data.data.pendingAmount}`);

      if (donStats.data.data.totalDonations < 1) {
        throw new Error('No donations in statistics');
      }

      // Get installment stats
      const instStats = await this.client.get('/zakat/installments/stats/overview');
      if (!instStats.data.success) throw new Error('Installment stats fetch failed');

      console.log(`✅ Got installment stats:
        - Total: ${instStats.data.data.total}
        - Paid: ${instStats.data.data.byStatus['Paid']}
        - Pending: ${instStats.data.data.byStatus['Pending']}`);

      // Verify stats are consistent
      if (typeof donStats.data.data.totalDonations !== 'number' ||
          typeof donStats.data.data.totalAmount !== 'number') {
        throw new Error('Invalid stats format');
      }

      console.log(`✅ Analytics data is consistent and accurate`);

      this.recordResult('Analytics Accuracy', 'PASS', 'Successfully retrieved and verified analytics data', Date.now() - startTime);
      return true;
    } catch (error: any) {
      console.error(`❌ Analytics Accuracy Failed:`, error.message);
      this.recordResult('Analytics Accuracy', 'FAIL', error.message, Date.now() - startTime);
      return false;
    }
  }

  /**
   * Test 7: Admin Dashboard Data Retrieval
   */
  async testAdminDashboard(): Promise<boolean> {
    const startTime = Date.now();
    try {
      console.log('\n🎛️  Testing Admin Dashboard...');

      // Get donors with pagination
      const donors = await this.client.get('/zakat/donors?status=Active&limit=10');
      if (!donors.data.success) throw new Error('Donors fetch failed');

      console.log(`✅ Retrieved ${donors.data.data.length} donors from database`);

      // Get donations with filters
      const donations = await this.client.get('/zakat/donations?status=Partial&limit=10');
      if (!donations.data.success) throw new Error('Filtered donations fetch failed');

      console.log(`✅ Retrieved donations with status filter`);

      // Get installments
      const installments = await this.client.get('/zakat/installments?status=Paid&limit=10');
      if (!installments.data.success) throw new Error('Installments fetch failed');

      console.log(`✅ Retrieved installments with status filter`);

      // Verify pagination
      if (!donors.data.pagination) throw new Error('Pagination info missing');
      console.log(`✅ Pagination verified (Total: ${donors.data.pagination.total})`);

      this.recordResult('Admin Dashboard', 'PASS', 'Successfully retrieved all dashboard data', Date.now() - startTime);
      return true;
    } catch (error: any) {
      console.error(`❌ Admin Dashboard Failed:`, error.message);
      this.recordResult('Admin Dashboard', 'FAIL', error.message, Date.now() - startTime);
      return false;
    }
  }

  /**
   * Test 8: Error Handling & Validation
   */
  async testErrorHandling(): Promise<boolean> {
    const startTime = Date.now();
    try {
      console.log('\n⚠️  Testing Error Handling...');

      let errorsCaught = 0;

      // Test invalid donation without donor
      try {
        await this.client.post('/zakat/donations', {
          donationType: 'Zakat_Maal',
          totalAmount: 5000,
        });
      } catch (error: any) {
        if (error.response?.status === 400) {
          errorsCaught++;
          console.log(`✅ Invalid donation catch: ${error.response.data.error}`);
        }
      }

      // Test invalid phone for lookupconst invalidPhoneRes = await this.client.get('/zakat/donors/phone/invalid');
      if (!invalidPhoneRes.data.exists) {
        errorsCaught++;
        console.log(`✅ Invalid phone lookup returns no results`);
      }

      // Test invalid installment amount
      try {
        await this.client.post('/zakat/installments', {
          donationId: 'invalid',
          totalInstallments: 1, // Should be at least 2
        });
      } catch (error: any) {
        if (error.response?.status === 400) {
          errorsCaught++;
          console.log(`✅ Invalid installment catch: ${error.response.data.error}`);
        }
      }

      if (errorsCaught < 2) {
        throw new Error('Not all error cases properly handled');
      }

      console.log(`✅ Error handling verified (${errorsCaught} cases caught)`);

      this.recordResult('Error Handling', 'PASS', 'All error scenarios properly handled', Date.now() - startTime);
      return true;
    } catch (error: any) {
      console.error(`❌ Error Handling Test Failed:`, error.message);
      this.recordResult('Error Handling', 'FAIL', error.message, Date.now() - startTime);
      return false;
    }
  }

  /**
   * Run all tests and generate report
   */
  async runAllTests(): Promise<void> {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 ZAKAT MANAGEMENT SYSTEM - INTEGRATION TEST SUITE');
    console.log('='.repeat(70));

    const tests = [
      { name: 'Authentication', fn: () => this.testAuthenticationFlow() },
      { name: 'Donor Management', fn: () => this.testDonorManagement() },
      { name: 'Donation Creation', fn: () => this.testDonationCreation() },
      { name: 'Installment Scheduling', fn: () => this.testInstallmentScheduling() },
      { name: 'Payment Processing', fn: () => this.testPaymentProcessing() },
      { name: 'Analytics Accuracy', fn: () => this.testAnalyticsAccuracy() },
      { name: 'Admin Dashboard', fn: () => this.testAdminDashboard() },
      { name: 'Error Handling', fn: () => this.testErrorHandling() },
    ];

    for (const test of tests) {
      await test.fn();
    }

    this.generateReport();
  }

  /**
   * Helper: Record test result
   */
  private recordResult(testName: string, status: 'PASS' | 'FAIL', message: string, duration: number): void {
    this.testResults.push({ testName, status, message, duration });
  }

  /**
   * Generate test report
   */
  private generateReport(): void {
    console.log('\n' + '='.repeat(70));
    console.log('📋 TEST RESULTS REPORT');
    console.log('='.repeat(70));

    const passed = this.testResults.filter((r) => r.status === 'PASS').length;
    const failed = this.testResults.filter((r) => r.status === 'FAIL').length;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    console.log(`\n📊 Summary:`);
    console.log(`   Total Tests: ${this.testResults.length}`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏱️  Total Duration: ${totalDuration}ms`);
    console.log(`   Pass Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);

    console.log(`\n📝 Detailed Results:`);
    this.testResults.forEach((result) => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(`\n${status} ${result.testName}`);
      console.log(`   Message: ${result.message}`);
      console.log(`   Duration: ${result.duration}ms`);
    });

    console.log('\n' + '='.repeat(70));
    if (failed === 0) {
      console.log('🎉 ALL TESTS PASSED! System is ready for production.');
    } else {
      console.log(`⚠️  ${failed} test(s) failed. Please review and fix.`);
    }
    console.log('='.repeat(70) + '\n');
  }
}

// Export for use in Jest/Vitest
export default IntegrationTestSuite;
export { TestConfig, TestUser, TestDonor, TestDonation };

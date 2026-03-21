import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import ZakatPayment from '../models/ZakatPayment';

const rootDir = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(rootDir, '.env') });

type ZakatPaymentModelType = typeof ZakatPayment & {
  updateMany: (filter: Record<string, unknown>, update: Record<string, unknown>) => Promise<{ modifiedCount?: number }>;
};

const ZakatPaymentModel = ZakatPayment as ZakatPaymentModelType;

const run = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI || 'mongodb://localhost:27017/hikmahsphere';
    await mongoose.connect(mongoUri, { authSource: 'admin' });

    const result = await ZakatPaymentModel.updateMany(
      { purpose: { $exists: false } },
      { $set: { purpose: 'Zakat' } }
    );

    const modified = Number(result?.modifiedCount || 0);
    await ZakatPayment.collection.createIndex({ type: 1, purpose: 1, paymentDate: -1 });

    console.log(`Backfilled purpose for ${modified} transaction(s) with default Zakat.`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to migrate zakat purpose:', error);
    process.exit(1);
  }
};

void run();

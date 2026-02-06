#!/bin/bash
echo "🔌 Connecting to In-Memory Database..."
echo "--------------------------------------------------------------------------------"
printf "%-25s %-15s %-30s %-10s\n" "ID" "USERNAME" "EMAIL" "ROLE"
echo "--------------------------------------------------------------------------------"

# Fetch data and use Node.js to format it as a table
RESPONSE=$(curl -s http://127.0.0.1:5000/api/tools/users)

node -e "
try {
    const data = JSON.parse('$RESPONSE');
    if (data.status === 'error') {
        console.log('❌ Error from server:', data.message);
        process.exit(1);
    }
    
    // Check if data is array directly or wrapped
    const users = Array.isArray(data) ? data : (data.data ? data.data : []);
    
    if (users.length === 0) {
        console.log('No users found in database.');
    } else {
        users.forEach(u => {
            const id = (u._id || 'N/A').padEnd(25);
            const username = (u.username || 'N/A').padEnd(15);
            const email = (u.email || 'N/A').padEnd(30);
            const role = (u.role || (u.isAdmin ? 'superadmin' : 'user')).padEnd(10);
            console.log(\`\${id} \${username} \${email} \${role}\`);
        });
    }
} catch (e) {
    console.log('❌ Failed to parse response:', e.message);
    console.log('Raw response:', '$RESPONSE'.substring(0, 100) + '...');
}
"
echo "--------------------------------------------------------------------------------"
echo "🔑 Default Admin: admin@hikmah.com / copernicus"

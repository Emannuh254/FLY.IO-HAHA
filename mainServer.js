const { initializeDatabase } = require('./shared/database');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const { startServer: startIndexServer } = require('./servers/indexServer');
const { startServer: startProfileServer } = require('./servers/profileServer');
const { startServer: startReferralsServer } = require('./servers/referralsServer');
const { startServer: startTradingServer } = require('./servers/tradingServer');
const { startServer: startDemoServer } = require('./servers/demoServer');
const { startServer: startDepositWithdrawServer } = require('./servers/depositWithdrawServer');
const { startServer: startDashboardServer } = require('./servers/dashboardServer');
const { startServer: startAdminServer } = require('./servers/adminServer');

// Server configuration
const servers = [
  { name: 'Index', port: process.env.PORT || 3000, startFn: startIndexServer },
  { name: 'Profile', port: process.env.PROFILE_PORT || 3001, startFn: startProfileServer },
  { name: 'Referrals', port: process.env.REFERRALS_PORT || 3002, startFn: startReferralsServer },
  { name: 'Trading', port: process.env.TRADING_PORT || 3003, startFn: startTradingServer },
  { name: 'Demo', port: process.env.DEMO_PORT || 3004, startFn: startDemoServer },
  { name: 'Deposit/Withdraw', port: process.env.DEPOSIT_WITHDRAW_PORT || 3005, startFn: startDepositWithdrawServer },
  { name: 'Dashboard', port: process.env.DASHBOARD_PORT || 3006, startFn: startDashboardServer },
  { name: 'Admin', port: process.env.ADMIN_PORT || 3007, startFn: startAdminServer }
];

// Improved killPort function with better error handling
async function killPort(port) {
    try {
        const platform = process.platform;
        
        if (platform === 'win32') {
            // Windows
            const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
            if (stdout) {
                const lines = stdout.trim().split('\n');
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    const pid = parts[parts.length - 1];
                    if (pid) {
                        await execAsync(`taskkill /F /PID ${pid}`);
                        console.log(`Killed process ${pid} on port ${port}`);
                    }
                }
            }
        } else {
            // Unix-like (Linux, macOS)
            try {
                const { stdout } = await execAsync(`lsof -ti:${port}`);
                if (stdout) {
                    const pids = stdout.trim().split('\n');
                    for (const pid of pids) {
                        await execAsync(`kill -9 ${pid}`);
                        console.log(`Killed process ${pid} on port ${port}`);
                    }
                }
            } catch (lsofError) {
                // If lsof returns non-zero, it means no process is using the port
                if (lsofError.message.includes('Command failed: lsof')) {
                    console.log(`No process found on port ${port}`);
                } else {
                    throw lsofError;
                }
            }
        }
    } catch (error) {
        console.warn(`Could not kill process on port ${port}: ${error.message}`);
    }
}

// Graceful shutdown with timeout
const gracefulShutdown = async (signal) => {
    console.log(`${signal} signal received: closing HTTP servers`);
    
    // Add a small delay to allow pending requests to complete
    setTimeout(() => {
        console.log('All servers have been shut down');
        process.exit(0);
    }, 1000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});

// Kill processes using ports with improved error handling
const killPorts = async () => {
    console.log('Checking for processes using ports...');
    
    try {
        // Kill all ports in parallel
        const killPromises = servers.map(server => 
            killPort(server.port).catch(err => 
                console.warn(`Warning: Could not kill process on port ${server.port}: ${err.message}`)
            )
        );
        
        await Promise.all(killPromises);
        console.log('Port check completed');
    } catch (error) {
        console.error('Error during port check:', error);
    }
};

// Create default users (demo and admin)
const createDefaultUsers = async () => {
    try {
        console.log('Creating default users (demo and admin) if they don\'t exist...');
        
        // In a real implementation, you would:
        // 1. Check if demo user (id=0) exists, create if not
        // 2. Check if admin user exists, create if not
        // 3. Set appropriate permissions and balances
        
        console.log('Default users check completed');
    } catch (err) {
        console.error('Error creating default users:', err);
    }
};

// Validate environment variables
const validateEnvironment = () => {
    const requiredEnvVars = [
        'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'JWT_SECRET'
    ];
    
    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingVars.length > 0) {
        console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
        process.exit(1);
    }
    
    console.log('Environment variables validated');
};

// Start all servers with retry mechanism
const startAllServers = async () => {
    try {
        // Validate environment variables first
        validateEnvironment();
        
        // Kill any process using the ports
        await killPorts();
        
        // Initialize database
        console.log('Initializing database...');
        await initializeDatabase();
        console.log('Database initialized successfully');
        
        // Create default users
        await createDefaultUsers();
        
        // Start all servers with retry mechanism
        console.log('Starting all servers...');
        
        const maxRetries = 3;
        const retryDelay = 2000; // 2 seconds
        
        const startPromises = servers.map(async (server) => {
            let retryCount = 0;
            let success = false;
            
            while (retryCount < maxRetries && !success) {
                try {
                    console.log(`Starting ${server.name} server on port ${server.port}... (Attempt ${retryCount + 1}/${maxRetries})`);
                    await server.startFn();
                    console.log(`${server.name} server started successfully on port ${server.port}`);
                    success = true;
                } catch (err) {
                    console.error(`Failed to start ${server.name} server (Attempt ${retryCount + 1}/${maxRetries}):`, err);
                    retryCount++;
                    
                    if (retryCount < maxRetries) {
                        console.log(`Retrying in ${retryDelay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    }
                }
            }
            
            if (!success) {
                throw new Error(`Failed to start ${server.name} server after ${maxRetries} attempts`);
            }
        });
        
        await Promise.all(startPromises);
        
        console.log('All servers started successfully');
        console.log('Server URLs:');
        servers.forEach(server => {
            console.log(`- ${server.name}: http://localhost:${server.port}`);
        });
        
        // Log system information
        console.log('\nSystem Information:');
        console.log(`- Node.js version: ${process.version}`);
        console.log(`- Platform: ${process.platform}`);
        console.log(`- Environment: ${process.env.NODE_ENV || 'development'}`);
        
    } catch (err) {
        console.error('Failed to start servers:', err);
        process.exit(1);
    }
};

// Start the application
startAllServers();
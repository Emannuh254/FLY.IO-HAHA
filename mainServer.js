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

// Implement killPort function
async function killPort(port) {
  try {
    // Check the platform
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
        // This is normal when starting fresh, so we can ignore it
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

// Graceful shutdown
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

// Kill processes using ports
const killPorts = async () => {
  console.log('Checking for processes using ports...');
  
  // Kill all ports in parallel
  const killPromises = servers.map(server => 
    killPort(server.port).catch(err => 
      console.warn(`Warning: Could not kill process on port ${server.port}: ${err.message}`)
    )
  );
  
  await Promise.all(killPromises);
  console.log('Port check completed');
};

// Start all servers
const startAllServers = async () => {
  try {
    // Kill any process using the ports
    await killPorts();
    
    // Initialize database
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    // Start all servers
    console.log('Starting all servers...');
    
    // Start servers in parallel
    const startPromises = servers.map(async (server) => {
      try {
        console.log(`Starting ${server.name} server on port ${server.port}...`);
        await server.startFn();
        console.log(`${server.name} server started successfully on port ${server.port}`);
      } catch (err) {
        console.error(`Failed to start ${server.name} server:`, err);
        throw err; // Re-throw to be caught by the outer try-catch
      }
    });
    
    await Promise.all(startPromises);
    
    console.log('All servers started successfully');
    console.log('Server URLs:');
    servers.forEach(server => {
      console.log(`- ${server.name}: http://localhost:${server.port}`);
    });
  } catch (err) {
    console.error('Failed to start servers:', err);
    process.exit(1);
  }
};

// Start the application
startAllServers();
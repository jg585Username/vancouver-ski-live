// Simple test to check if server.js has syntax errors
try {
  require('./server.js');
  console.log('Server file loaded successfully!');
} catch (err) {
  console.error('Error loading server:', err.message);
  console.error('Stack:', err.stack);
}

#!/bin/bash

echo "🧪 Testing Akshay's Framework Functionality..."
echo "=============================================="

# Test 1: Check if all packages build successfully
echo "✅ Test 1: Package Building"
npm run build
if [ $? -eq 0 ]; then
    echo "   ✓ All packages built successfully"
else
    echo "   ✗ Package build failed"
    exit 1
fi

# Test 2: Check if database is accessible
echo "✅ Test 2: Database Connectivity"
cd packages/api && npx prisma db push --accept-data-loss > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ Database is accessible and schema is valid"
else
    echo "   ✗ Database connectivity failed"
    exit 1
fi

# Test 3: Check if API can start (without Redis)
echo "✅ Test 3: API Service Startup"
cd /workspace/packages/api
timeout 10s npm run dev > /dev/null 2>&1 &
API_PID=$!
sleep 3

# Test API health endpoint
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "   ✓ API service started and responding"
    kill $API_PID 2>/dev/null
else
    echo "   ✗ API service failed to start or respond"
    kill $API_PID 2>/dev/null
    exit 1
fi

# Test 4: Check if Web service can start
echo "✅ Test 4: Web Service Startup"
cd /workspace/packages/web
timeout 10s npm run dev > /dev/null 2>&1 &
WEB_PID=$!
sleep 5

# Test web service
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "   ✓ Web service started and responding"
    kill $WEB_PID 2>/dev/null
else
    echo "   ✗ Web service failed to start or respond"
    kill $WEB_PID 2>/dev/null
    exit 1
fi

# Test 5: Check if Worker can compile (without Redis)
echo "✅ Test 5: Worker Compilation"
cd /workspace/packages/worker
if npm run build > /dev/null 2>&1; then
    echo "   ✓ Worker compiles successfully"
else
    echo "   ✗ Worker compilation failed"
    exit 1
fi

# Test 6: Check storage directories
echo "✅ Test 6: Storage Structure"
cd /workspace
if [ -d "storage" ] && [ -d "storage/artifacts" ] && [ -d "storage/logs" ] && [ -d "storage/reports" ]; then
    echo "   ✓ Storage directories exist"
else
    echo "   ✗ Storage directories missing"
    exit 1
fi

# Test 7: Check environment configuration
echo "✅ Test 7: Environment Configuration"
if [ -f ".env" ] && [ -f "packages/api/.env" ]; then
    echo "   ✓ Environment files exist"
else
    echo "   ✗ Environment files missing"
    exit 1
fi

# Test 8: Check Docker configuration (if available)
echo "✅ Test 8: Docker Configuration"
if [ -f "docker-compose.yml" ] && [ -f "packages/api/Dockerfile" ] && [ -f "packages/web/Dockerfile" ] && [ -f "packages/worker/Dockerfile" ]; then
    echo "   ✓ Docker configuration files exist"
else
    echo "   ✗ Docker configuration files missing"
    exit 1
fi

echo ""
echo "🎉 All tests passed! Akshay's Framework is functional."
echo ""
echo "📋 Current Status:"
echo "   • API Service: ✅ Ready (requires Redis for full functionality)"
echo "   • Web Service: ✅ Ready"
echo "   • Worker Service: ✅ Compiled (requires Redis for full functionality)"
echo "   • Database: ✅ Ready"
echo "   • Storage: ✅ Ready"
echo ""
echo "📋 Next Steps:"
echo "   1. Install Redis: sudo apt-get install redis-server"
echo "   2. Start Redis: sudo systemctl start redis-server"
echo "   3. Run full framework: npm run dev"
echo "   4. Or use Docker: docker-compose up -d"
echo ""
echo "🔧 For development without Redis:"
echo "   • API and Web services work independently"
echo "   • Worker service requires Redis for job processing"
echo "   • Database operations work normally"
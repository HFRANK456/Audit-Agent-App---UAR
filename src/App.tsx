import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Database, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  RefreshCw,
  Plus,
  ArrowUpRight,
  Filter,
  MoreVertical,
  LayoutDashboard,
  Link2,
  FileText,
  Settings,
  BrainCircuit,
  LogIn,
  LogOut,
  DatabaseZap
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeAccess } from './services/gemini';
import { Connector, AccessReview, AuditLog, ReviewStatus, User } from './types';
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy, 
  limit,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { mockConnectors, mockReviews, mockAuditLogs, mockUsers } from './lib/mockData';

function AuditGuardApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [reviews, setReviews] = useState<AccessReview[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [selectedReview, setSelectedReview] = useState<AccessReview | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isConnectorModalOpen, setIsConnectorModalOpen] = useState(false);
  const [newConnector, setNewConnector] = useState({ name: '', type: 'identity' as const, description: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
      
      if (user) {
        // Check if admin
        const adminEmail = "hen228@lehigh.edu";
        const isDefaultAdmin = user.email === adminEmail && user.emailVerified;
        
        // Sync user profile to Firestore
        const userRef = doc(db, 'users', user.uid);
        try {
          const userDoc = await getDoc(userRef);
          const userData = userDoc.exists() ? userDoc.data() : null;
          
          const finalIsAdmin = isDefaultAdmin || userData?.role === 'admin';
          setIsAdmin(finalIsAdmin);

          await setDoc(userRef, {
            id: user.uid,
            name: user.displayName || 'Anonymous',
            email: user.email || '',
            department: userData?.department || 'Unassigned',
            role: finalIsAdmin ? 'admin' : (userData?.role || 'user')
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listeners
  useEffect(() => {
    if (!isAuthReady || !currentUser) return;

    const unsubConnectors = onSnapshot(collection(db, 'connectors'), (snapshot) => {
      setConnectors(snapshot.docs.map(doc => doc.data() as Connector));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'connectors'));

    const unsubReviews = onSnapshot(collection(db, 'reviews'), (snapshot) => {
      setReviews(snapshot.docs.map(doc => doc.data() as AccessReview));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'reviews'));

    const unsubLogs = onSnapshot(query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(50)), (snapshot) => {
      setLogs(snapshot.docs.map(doc => doc.data() as AuditLog));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'logs'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as User));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    return () => {
      unsubConnectors();
      unsubReviews();
      unsubLogs();
      unsubUsers();
    };
  }, [isAuthReady, currentUser]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  const seedData = async () => {
    if (!currentUser || !isAdmin) return;
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      
      mockConnectors.forEach(c => {
        batch.set(doc(db, 'connectors', c.id), c);
      });
      
      mockReviews.forEach(r => {
        batch.set(doc(db, 'reviews', r.id), r);
      });
      
      mockAuditLogs.forEach(l => {
        batch.set(doc(db, 'logs', l.id), l);
      });
      
      mockUsers.forEach(u => {
        batch.set(doc(db, 'users', u.id), u);
      });
      
      await batch.commit();
      await createLog('System Seeded', 'Mock data successfully seeded into the database.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'batch-seed');
    } finally {
      setIsSeeding(false);
    }
  };

  const addConnector = async () => {
    if (!currentUser) return;
    const id = `c${Date.now()}`;
    const connector: Connector = {
      id,
      name: newConnector.name,
      type: newConnector.type,
      status: 'active',
      lastSync: new Date().toISOString(),
      description: newConnector.description
    };
    
    try {
      await setDoc(doc(db, 'connectors', id), connector);
      setIsConnectorModalOpen(false);
      setNewConnector({ name: '', type: 'identity', description: '' });
      
      await createLog('Connector Added', `New connector "${connector.name}" added.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `connectors/${id}`);
    }
  };

  const createLog = async (action: string, details: string, severity: AuditLog['severity'] = 'info') => {
    if (!currentUser) return;
    const id = `l${Date.now()}`;
    const log: AuditLog = {
      id,
      timestamp: new Date().toISOString(),
      action,
      user: currentUser.displayName || currentUser.email || 'Unknown',
      details,
      severity
    };
    try {
      await setDoc(doc(db, 'logs', id), log);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `logs/${id}`);
    }
  };

  const runAiAudit = async () => {
    if (!currentUser) return;
    setIsAnalyzing(true);
    const pendingReviews = reviews.filter(r => r.status === 'pending');
    
    for (const review of pendingReviews) {
      const user = users.find(u => u.id === review.userId);
      const connector = connectors.find(c => c.id === review.connectorId);
      
      if (user && connector) {
        const result = await analyzeAccess(review, user, connector);
        if (result) {
          try {
            await updateDoc(doc(db, 'reviews', review.id), {
              aiRecommendation: result.recommendation,
              aiConfidence: result.confidence,
              status: result.recommendation.toLowerCase().includes('flag') || result.recommendation.toLowerCase().includes('critical') ? 'flagged' : 'pending'
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `reviews/${review.id}`);
          }
        }
      }
    }
    
    setIsAnalyzing(false);
    await createLog('AI Audit Completed', `AI analysis completed for ${pendingReviews.length} reviews.`);
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      const user = users.find(u => u.id === userId);
      await createLog('User Role Updated', `User ${user?.name || userId} role changed to ${newRole}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    // Simulate sync delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSyncing(false);
    await createLog('Manual Sync', 'Manual synchronization of all connectors completed.');
  };

  const updateReviewStatus = async (id: string, status: ReviewStatus) => {
    try {
      await updateDoc(doc(db, 'reviews', id), { 
        status,
        lastReviewedAt: new Date().toISOString()
      });
      await createLog('Review Updated', `Access review ${id} marked as ${status}.`, status === 'flagged' || status === 'revoked' ? 'warning' : 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reviews/${id}`);
    }
  };

  const filteredReviews = reviews.filter(r => 
    r.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.connectorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.resource.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalUsers: users.length,
    activeConnectors: connectors.filter(c => c.status === 'active').length,
    pendingReviews: reviews.filter(r => r.status === 'pending').length,
    flaggedAccess: reviews.filter(r => r.status === 'flagged').length
  };

  const chartData = [
    { name: 'Approved', value: reviews.filter(r => r.status === 'approved').length, color: '#22c55e' },
    { name: 'Pending', value: reviews.filter(r => r.status === 'pending').length, color: '#eab308' },
    { name: 'Flagged', value: reviews.filter(r => r.status === 'flagged').length, color: '#ef4444' },
    { name: 'Revoked', value: reviews.filter(r => r.status === 'revoked').length, color: '#64748b' }
  ];

  const userAccess = selectedUser ? reviews.filter(r => r.userId === selectedUser.id) : [];

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <RefreshCw className="w-8 h-8 animate-spin text-[#1A1A1A]" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
        <Card className="max-w-md w-full border-none shadow-xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-[#1A1A1A] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="text-white w-10 h-10" />
            </div>
            <CardTitle className="text-2xl">AuditGuard AI</CardTitle>
            <CardDescription>
              Sign in to access the intelligent user access review dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full gap-2 bg-[#1A1A1A] hover:bg-[#333] h-12" onClick={handleLogin}>
              <LogIn size={20} />
              Sign in with Google
            </Button>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-xs text-[#6B7280]">Secure access for enterprise auditing.</p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-[#E5E7EB] z-50 hidden lg:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight">AuditGuard AI</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <SidebarLink 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarLink 
            icon={<Link2 size={20} />} 
            label="Connectors" 
            active={activeTab === 'connectors'} 
            onClick={() => setActiveTab('connectors')} 
          />
          <SidebarLink 
            icon={<BrainCircuit size={20} />} 
            label="Access Reviews" 
            active={activeTab === 'reviews'} 
            onClick={() => setActiveTab('reviews')} 
          />
          <SidebarLink 
            icon={<Users size={20} />} 
            label="Users" 
            active={activeTab === 'users'} 
            onClick={() => setActiveTab('users')} 
          />
          <SidebarLink 
            icon={<Activity size={20} />} 
            label="Audit Logs" 
            active={activeTab === 'logs'} 
            onClick={() => setActiveTab('logs')} 
          />
        </nav>

        <div className="p-4 border-t border-[#E5E7EB] space-y-2">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
              {currentUser.photoURL ? <img src={currentUser.photoURL} alt="" referrerPolicy="no-referrer" /> : <Users size={16} className="m-2" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{currentUser.displayName}</p>
              <p className="text-[10px] text-[#6B7280] truncate">{currentUser.email}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleLogout}>
            <LogOut size={20} />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight capitalize">{activeTab.replace('-', ' ')}</h1>
            <p className="text-[#6B7280] mt-1">Intelligent user access monitoring and auditing.</p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button 
                variant="outline" 
                className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50" 
                onClick={seedData}
                disabled={isSeeding}
              >
                <DatabaseZap className={`w-4 h-4 ${isSeeding ? 'animate-pulse' : ''}`} />
                {isSeeding ? 'Seeding...' : 'Seed Mock Data'}
              </Button>
            )}
            <Button 
              variant="outline" 
              className="gap-2" 
              onClick={handleSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Connectors'}
            </Button>
            <Button className="gap-2 bg-[#1A1A1A] hover:bg-[#333]">
              <Plus className="w-4 h-4" />
              New Review
            </Button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Total Users" value={stats.totalUsers} icon={<Users className="text-blue-500" />} />
                <StatCard label="Active Connectors" value={stats.activeConnectors} icon={<Database className="text-green-500" />} />
                <StatCard label="Pending Reviews" value={stats.pendingReviews} icon={<Clock className="text-yellow-500" />} />
                <StatCard label="Flagged Access" value={stats.flaggedAccess} icon={<AlertTriangle className="text-red-500" />} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <Card className="lg:col-span-2 border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>Review Status Distribution</CardTitle>
                    <CardDescription>Overview of all access review statuses across connectors.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip 
                          cursor={{ fill: '#F3F4F6' }}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Recent Logs */}
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Latest system and audit events.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {logs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex gap-3 items-start">
                        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                          log.severity === 'critical' ? 'bg-red-500' : 
                          log.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`} />
                        <div>
                          <p className="text-sm font-medium leading-none">{log.action}</p>
                          <p className="text-xs text-[#6B7280] mt-1 line-clamp-1">{log.details}</p>
                          <p className="text-[10px] text-[#9CA3AF] mt-1">{new Date(log.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                    <Button variant="ghost" className="w-full text-xs text-blue-600 hover:text-blue-700" onClick={() => setActiveTab('logs')}>
                      View All Logs
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Critical Reviews Table */}
              <Card className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Critical Access Flags</CardTitle>
                    <CardDescription>Access permissions flagged by AI for immediate review.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('reviews')}>View All</Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Connector</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>AI Recommendation</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviews.filter(r => r.status === 'flagged').map((review) => (
                        <TableRow key={review.id}>
                          <TableCell>
                            <div className="font-medium">{review.userName}</div>
                            <div className="text-xs text-[#6B7280]">{review.userEmail}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal">{review.connectorName}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{review.resource}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-red-600 font-medium text-sm">
                              <AlertTriangle size={14} />
                              {review.aiRecommendation}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700" onClick={() => setSelectedReview(review)}>Review</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {reviews.filter(r => r.status === 'flagged').length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-[#9CA3AF]">
                            No critical flags found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'connectors' && (
            <motion.div 
              key="connectors"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {connectors.map((connector) => (
                <Card key={connector.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className={`p-2 rounded-lg ${connector.type === 'identity' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                        {connector.type === 'identity' ? <Users size={20} /> : <Database size={20} />}
                      </div>
                      <Badge className={
                        connector.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 
                        connector.status === 'error' ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                      }>
                        {connector.status}
                      </Badge>
                    </div>
                    <CardTitle className="mt-4">{connector.name}</CardTitle>
                    <CardDescription className="line-clamp-2">{connector.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-xs text-[#6B7280] pt-4 border-t border-[#F3F4F6]">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        Last Sync: {new Date(connector.lastSync).toLocaleDateString()}
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 px-2">Manage</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Card 
                className="border-dashed border-2 bg-transparent flex flex-center items-center justify-center p-8 cursor-pointer hover:bg-white transition-colors"
                onClick={() => setIsConnectorModalOpen(true)}
              >
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center mx-auto mb-3">
                    <Plus className="text-[#6B7280]" />
                  </div>
                  <p className="font-medium text-[#4B5563]">Add New Connector</p>
                  <p className="text-xs text-[#9CA3AF] mt-1">Connect identity or data layers</p>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'reviews' && (
            <motion.div 
              key="reviews"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                  <Input 
                    placeholder="Search users, resources or connectors..." 
                    className="pl-10 bg-[#F9FAFB] border-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Button 
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                    onClick={runAiAudit}
                    disabled={isAnalyzing}
                  >
                    <BrainCircuit size={16} className={isAnalyzing ? 'animate-pulse' : ''} />
                    {isAnalyzing ? 'Analyzing...' : 'Run AI Audit'}
                  </Button>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-full md:w-40 bg-[#F9FAFB] border-none">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="flagged">Flagged</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="gap-2 shrink-0">
                    <Filter size={16} />
                    Filters
                  </Button>
                </div>
              </div>

              <Card className="border-none shadow-sm">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6">User</TableHead>
                        <TableHead>Connector</TableHead>
                        <TableHead>Resource & Permission</TableHead>
                        <TableHead>AI Insight</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="pr-6 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReviews.map((review) => (
                        <TableRow key={review.id}>
                          <TableCell className="pl-6 py-4">
                            <div className="font-medium">{review.userName}</div>
                            <div className="text-xs text-[#6B7280]">{review.userEmail}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-normal bg-gray-100 text-gray-700">
                              {review.connectorName}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-mono">{review.resource}</div>
                            <div className="text-xs text-[#6B7280] mt-1">{review.permission}</div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {review.aiRecommendation ? (
                              <div className={`text-xs p-2 rounded-lg flex gap-2 ${
                                review.status === 'flagged' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                              }`}>
                                <BrainCircuit size={14} className="shrink-0 mt-0.5" />
                                <span>{review.aiRecommendation}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-[#9CA3AF]">No analysis yet</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              review.status === 'approved' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                              review.status === 'pending' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' :
                              review.status === 'flagged' ? 'bg-red-100 text-red-700 hover:bg-red-100' :
                              'bg-gray-100 text-gray-700 hover:bg-gray-100'
                            }>
                              {review.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-blue-600 h-8"
                                onClick={() => setSelectedReview(review)}
                              >
                                Details
                              </Button>
                              {review.status === 'pending' && (
                                <>
                                  <Button 
                                    size="sm" 
                                    className="bg-green-600 hover:bg-green-700 h-8"
                                    onClick={() => updateReviewStatus(review.id, 'approved')}
                                  >
                                    Approve
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="text-red-600 border-red-200 hover:bg-red-50 h-8"
                                    onClick={() => updateReviewStatus(review.id, 'flagged')}
                                  >
                                    Flag
                                  </Button>
                                </>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical size={16} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div 
              key="users"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card className="border-none shadow-sm">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="pr-6 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="pl-6 font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.department}</TableCell>
                          <TableCell>
                            {isAdmin ? (
                              <Select 
                                defaultValue={user.role} 
                                onValueChange={(value) => updateUserRole(user.id, value)}
                              >
                                <SelectTrigger className="w-[110px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="guest">Guest</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="secondary" className="capitalize">{user.role}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedUser(user)}>
                              View Access
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'logs' && (
            <motion.div 
              key="logs"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle>System Audit Logs</CardTitle>
                  <CardDescription>Comprehensive history of all actions and system events.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Severity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-[#6B7280]">
                            {new Date(log.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-medium">{log.action}</TableCell>
                          <TableCell>{log.user}</TableCell>
                          <TableCell className="text-sm">{log.details}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              log.severity === 'critical' ? 'border-red-200 text-red-700 bg-red-50' :
                              log.severity === 'warning' ? 'border-yellow-200 text-yellow-700 bg-yellow-50' :
                              'border-blue-200 text-blue-700 bg-blue-50'
                            }>
                              {log.severity}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Detail Modal */}
        <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>User Access Profile</DialogTitle>
              <DialogDescription>
                Comprehensive view of all permissions and resources for {selectedUser?.name}.
              </DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-6 py-4">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-12 h-12 bg-[#1A1A1A] rounded-full flex items-center justify-center text-white text-xl font-bold">
                    {selectedUser.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{selectedUser.name}</h3>
                    <p className="text-sm text-[#6B7280]">{selectedUser.role} • {selectedUser.department}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm uppercase tracking-wider text-[#9CA3AF]">Assigned Permissions</h4>
                  <ScrollArea className="h-[300px] rounded-md border p-4">
                    <div className="space-y-4">
                      {userAccess.length > 0 ? userAccess.map((access) => (
                        <div key={access.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{access.resource}</span>
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">{access.connectorName}</Badge>
                            </div>
                            <p className="text-xs text-[#6B7280] mt-1">{access.permission}</p>
                          </div>
                          <Badge className={
                            access.status === 'approved' ? 'bg-green-100 text-green-700' :
                            access.status === 'flagged' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }>
                            {access.status}
                          </Badge>
                        </div>
                      )) : (
                        <p className="text-center text-[#9CA3AF] py-8">No access records found for this user.</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Review Detail Modal */}
        <Dialog open={!!selectedReview} onOpenChange={(open) => !open && setSelectedReview(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Access Review Detail</DialogTitle>
              <DialogDescription>
                Detailed analysis and decision for {selectedReview?.userName}'s access.
              </DialogDescription>
            </DialogHeader>
            {selectedReview && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-[#6B7280]">User</Label>
                    <p className="font-medium">{selectedReview.userName}</p>
                    <p className="text-xs text-[#6B7280]">{selectedReview.userEmail}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-[#6B7280]">Connector</Label>
                    <p className="font-medium">{selectedReview.connectorName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-[#6B7280]">Resource</Label>
                    <p className="font-mono text-sm">{selectedReview.resource}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-[#6B7280]">Permission</Label>
                    <p className="font-medium">{selectedReview.permission}</p>
                  </div>
                </div>

                <Separator />

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2 text-blue-800 font-bold mb-2">
                    <BrainCircuit size={18} />
                    AI Reasoning
                  </div>
                  <p className="text-sm text-blue-900 leading-relaxed">
                    {selectedReview.aiRecommendation || "AI analysis has not been performed for this review yet."}
                  </p>
                  {selectedReview.aiConfidence && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-blue-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600" 
                          style={{ width: `${selectedReview.aiConfidence * 100}%` }} 
                        />
                      </div>
                      <span className="text-[10px] font-bold text-blue-700">
                        {Math.round(selectedReview.aiConfidence * 100)}% Confidence
                      </span>
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2">
                  <Button 
                    variant="outline" 
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => {
                      updateReviewStatus(selectedReview.id, 'revoked');
                      setSelectedReview(null);
                    }}
                  >
                    Revoke Access
                  </Button>
                  <Button 
                    variant="outline" 
                    className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                    onClick={() => {
                      updateReviewStatus(selectedReview.id, 'flagged');
                      setSelectedReview(null);
                    }}
                  >
                    Flag for Investigation
                  </Button>
                  <Button 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      updateReviewStatus(selectedReview.id, 'approved');
                      setSelectedReview(null);
                    }}
                  >
                    Approve Access
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Connector Modal */}
        <Dialog open={isConnectorModalOpen} onOpenChange={setIsConnectorModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Connector</DialogTitle>
              <DialogDescription>
                Integrate a new identity provider or data layer for auditing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Connector Name</Label>
                <Input 
                  id="name" 
                  placeholder="e.g. GitHub Enterprise, MongoDB Atlas" 
                  value={newConnector.name}
                  onChange={(e) => setNewConnector({ ...newConnector, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select 
                  value={newConnector.type} 
                  onValueChange={(v: any) => setNewConnector({ ...newConnector, type: v })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="identity">Identity Layer (IDP)</SelectItem>
                    <SelectItem value="data">Data Layer (DB/Storage)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Input 
                  id="desc" 
                  placeholder="Briefly describe the purpose of this connector" 
                  value={newConnector.description}
                  onChange={(e) => setNewConnector({ ...newConnector, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsConnectorModalOpen(false)}>Cancel</Button>
              <Button 
                className="bg-[#1A1A1A]" 
                onClick={addConnector}
                disabled={!newConnector.name}
              >
                Add Connector
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        active 
          ? 'bg-[#1A1A1A] text-white shadow-lg shadow-black/10' 
          : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A1A1A]'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
      {active && <motion.div layoutId="sidebar-active" className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />}
    </button>
  );
}

function StatCard({ label, value, icon }: { label: string, value: number | string, icon: React.ReactNode }) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#6B7280]">{label}</p>
            <h3 className="text-2xl font-bold mt-1">{value}</h3>
          </div>
          <div className="p-3 bg-[#F9FAFB] rounded-xl">
            {icon}
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs text-green-600 font-medium">
          <ArrowUpRight size={14} className="mr-1" />
          <span>12% from last month</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function App() {
  return (
    <AuditGuardApp />
  );
}

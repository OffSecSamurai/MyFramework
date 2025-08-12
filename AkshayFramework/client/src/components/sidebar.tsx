import { Link, useLocation } from "wouter";
import { Shield, BarChart3, Target, Search, FileText, Settings } from "lucide-react";

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Targets', href: '/targets', icon: Target },
  { name: 'Scans', href: '/scans', icon: Search },
  { name: 'Results', href: '/results', icon: FileText },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-dark-card border-r border-dark-border flex flex-col">
      <div className="p-6 border-b border-dark-border">
        <h1 className="text-xl font-bold text-brand-green flex items-center">
          <Shield className="mr-3 w-6 h-6" />
          Akshay's Framework
        </h1>
        <p className="text-gray-400 text-sm mt-1">Professional Bug Bounty Platform</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link key={item.name} href={item.href}>
              <div className={`flex items-center px-4 py-3 rounded-lg font-medium transition-all ${
                isActive
                  ? 'bg-brand-green text-black'
                  : 'text-gray-300 hover:bg-dark-border hover:text-white'
              }`}>
                <Icon className="mr-3 w-5 h-5" />
                {item.name}
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

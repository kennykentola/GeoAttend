import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../../types';

const Home: React.FC = () => {
  const { user } = useAuth();

  const getDashboardLink = () => {
      if (!user) return '/login';
      if (user.role === UserRole.ADMIN) return '/admin/dashboard';
      if (user.role === UserRole.LECTURER) return '/lecturer/dashboard';
      return '/student/attendance';
  };

  return (
    <div className="min-h-screen relative font-sans text-gray-100 overflow-x-hidden bg-gray-900">
      
      {/* Absolute Background Image with Overlay */}
      <div className="fixed inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070&auto=format&fit=crop" 
            alt="University Campus Students" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 via-gray-900/80 to-indigo-900/70 backdrop-blur-[2px]"></div>
      </div>

      {/* Content Wrapper */}
      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* Navigation */}
        <nav className="w-full px-6 py-6 max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg ring-1 ring-white/20">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.499 5.216 50.59 50.59 0 00-2.658.812m-15.482 0a50.57 50.57 0 012.658.812m12.824 0a50.57 50.57 0 002.658-.812" />
               </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white hidden sm:block">HIA</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Link 
                to={getDashboardLink()}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md transition-all font-medium text-white"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-gray-300 hover:text-white font-medium transition-colors hidden sm:block">
                  Log In
                </Link>
                <Link 
                  to="/register"
                  className="px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition-all font-semibold transform hover:-translate-y-0.5"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <header className="flex-1 flex flex-col justify-center px-6 py-12 max-w-7xl mx-auto w-full">
            <div className="max-w-4xl space-y-8 animate-fade-in-up">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 text-xs font-bold tracking-widest uppercase backdrop-blur-md">
                   <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2 animate-pulse"></span>
                   Next Gen Campus Tech
                </div>
                
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.1] text-white drop-shadow-xl">
                  Attendance <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                    Reimagined.
                  </span>
                </h1>
                
                <p className="text-xl text-gray-300 max-w-2xl leading-relaxed">
                  Eliminate proxies and streamline academic tracking with our secure, location-based verification system. Built for the modern university.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                   <Link 
                      to="/register" 
                      className="px-8 py-4 rounded-full bg-white text-indigo-900 font-bold text-lg hover:bg-gray-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transform hover:scale-105"
                   >
                      Start Free Trial
                   </Link>
                   <a 
                      href="#features" 
                      className="px-8 py-4 rounded-full bg-transparent border border-white/20 hover:bg-white/10 text-white font-bold text-lg transition-all backdrop-blur-sm"
                   >
                      See Features
                   </a>
                </div>
            </div>
        </header>

        {/* Feature Grid */}
        <section id="features" className="py-24 px-6 bg-black/20 backdrop-blur-sm">
           <div className="max-w-7xl mx-auto">
              <div className="mb-16">
                  <h2 className="text-3xl font-bold text-white mb-4">Why choose HIA?</h2>
                  <div className="h-1 w-20 bg-indigo-500 rounded-full"></div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Card 1 */}
                  <div className="p-8 rounded-3xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 hover:border-indigo-500/50 transition-all duration-300 group">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-6 text-indigo-300 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold mb-3 text-white">Geo-Fencing</h3>
                      <p className="text-gray-400 leading-relaxed text-sm">
                        Verification is restricted to precise coordinates. Students must be physically present in the lecture hall to check in.
                      </p>
                  </div>

                  {/* Card 2 */}
                  <div className="p-8 rounded-3xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 hover:border-purple-500/50 transition-all duration-300 group">
                      <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6 text-purple-300 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75zM16.5 19.5h.75v.75h-.75v-.75z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold mb-3 text-white">Dynamic QR</h3>
                      <p className="text-gray-400 leading-relaxed text-sm">
                        Secure session codes rotate automatically, preventing remote check-ins and code sharing between students.
                      </p>
                  </div>

                  {/* Card 3 */}
                  <div className="p-8 rounded-3xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 hover:border-pink-500/50 transition-all duration-300 group">
                      <div className="w-14 h-14 rounded-2xl bg-pink-500/20 flex items-center justify-center mb-6 text-pink-300 group-hover:scale-110 transition-transform">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                         </svg>
                      </div>
                      <h3 className="text-xl font-bold mb-3 text-white">Live Analytics</h3>
                      <p className="text-gray-400 leading-relaxed text-sm">
                        Watch attendance populate in real-time. Export reports to CSV instantly for administration and record keeping.
                      </p>
                  </div>
              </div>
           </div>
        </section>

        {/* Footer */}
        <footer className="py-8 text-center text-gray-500 text-sm border-t border-white/5 bg-black/40">
            <p>&copy; {new Date().getFullYear()} Higher Institution Attendance. Secure. Simple. Smart.</p>
        </footer>

      </div>
    </div>
  );
};

export default Home;
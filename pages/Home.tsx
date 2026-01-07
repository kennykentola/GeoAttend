
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

const Home: React.FC = () => {
  const { user } = useAuth();

  const getDashboardLink = () => {
      if (!user) return '/login';
      if (user.roles.includes(UserRole.ADMIN)) return '/admin/dashboard';
      if (user.roles.includes(UserRole.LECTURER)) return '/lecturer/dashboard';
      return '/student/dashboard';
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Dynamic Background Layer */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] bg-indigo-50/50 rounded-full blur-[120px] animate-blob"></div>
        <div className="absolute bottom-[5%] left-[-10%] w-[600px] h-[600px] bg-violet-50/50 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
        <div className="absolute top-[30%] left-[10%] w-full h-full bg-grid-slate-100 [mask-image:linear-gradient(to_bottom,white,transparent)] opacity-40"></div>
      </div>

      <div className="relative z-10 flex flex-col">
        
        {/* Navigation - Floating Glassmorphism */}
        <nav className="w-full px-6 py-6 max-w-7xl mx-auto flex justify-between items-center sticky top-0 bg-white/60 backdrop-blur-xl z-50 rounded-[2rem] mt-4 border border-slate-100 shadow-sm transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-100 rotate-3 hover:rotate-0 transition-all duration-500">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white">
                  <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337a49.94 49.94 0 0 0-9.9 2.133V19a.75.75 0 0 1-1.44 0v-6.805a49.94 49.94 0 0 0-9.9-2.133.75.75 0 0 1-.231-1.337A60.65 60.65 0 0 1 11.7 2.805Z" />
               </svg>
            </div>
            <div className="flex flex-col">
                <span className="text-xl font-black tracking-tighter text-slate-900 leading-none">HIA</span>
                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-1">Institutional Presence</span>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="hidden md:flex items-center gap-8 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                <a href="#features" className="hover:text-indigo-600 transition-colors">Framework</a>
                <a href="#governance" className="hover:text-indigo-600 transition-colors">Governance</a>
            </div>
            {user ? (
              <Link 
                to={getDashboardLink()}
                className="px-8 py-3 rounded-full bg-slate-900 text-white font-black text-[11px] uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-200 active:scale-95"
              >
                Dashboard
              </Link>
            ) : (
              <div className="flex items-center gap-6">
                <Link to="/login" className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-indigo-600 transition-colors">
                  Log In
                </Link>
                <Link 
                  to="/register"
                  className="px-8 py-3 rounded-full bg-indigo-600 text-white font-black text-[11px] uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 active:scale-95"
                >
                  Establish ID
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <header className="px-6 pt-32 pb-24 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="space-y-12 animate-slide-up">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black tracking-[0.3em] uppercase">
                   <span className="w-2 h-2 bg-indigo-500 rounded-full mr-3 animate-pulse shadow-[0_0_8px_rgba(79,70,229,0.5)]"></span>
                   Next-Generation Attendance Protocol
                </div>
                
                <h1 className="text-7xl md:text-8xl lg:text-9xl font-black text-slate-900 leading-[0.85] tracking-tighter">
                  Presence <br />
                  <span className="text-gradient">Verified.</span>
                </h1>
                
                <p className="text-2xl text-slate-400 max-w-xl leading-relaxed font-medium">
                  Eliminate academic proxies with the definitive spatial verification system for Higher Institutions.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-6 pt-4">
                   <Link 
                      to="/register" 
                      className="px-12 py-6 rounded-[2rem] bg-indigo-600 text-white font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 active:scale-95 flex items-center justify-center group"
                   >
                      Get Started
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3" />
                      </svg>
                   </Link>
                   <a 
                      href="#features" 
                      className="px-12 py-6 rounded-[2rem] bg-white border-2 border-slate-100 hover:border-slate-200 text-slate-600 font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center active:scale-95"
                   >
                      System Architecture
                   </a>
                </div>
            </div>

            <div className="relative animate-fade-in hidden lg:block">
               <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-indigo-50/40 rounded-full blur-[100px] opacity-60"></div>
               <div className="relative p-12 bg-white/40 backdrop-blur-3xl rounded-[4rem] border border-white shadow-[0_48px_96px_-24px_rgba(0,0,0,0.08)]">
                  <div className="absolute -top-6 -right-6 w-32 h-32 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl animate-float">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-16 h-16">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                  </div>
                  <img 
                    src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070&auto=format&fit=crop" 
                    alt="Institutional Excellence" 
                    className="rounded-[3rem] object-cover aspect-[4/3] shadow-inner grayscale-[40%] hover:grayscale-0 transition-all duration-700"
                  />
               </div>
            </div>
        </header>

        {/* Core Capabilities */}
        <section id="features" className="py-40 px-6 relative overflow-hidden">
           <div className="max-w-7xl mx-auto relative">
              <div className="flex flex-col md:flex-row justify-between items-end mb-32 gap-10">
                  <div className="space-y-6 max-w-2xl">
                      <h2 className="text-6xl font-black text-slate-900 tracking-tighter leading-none">Security By <br/><span className="text-indigo-600">Spatial Intent.</span></h2>
                      <p className="text-xl text-slate-400 font-medium leading-relaxed">Integrated protocols designed for absolute administrative oversight and frictionless student experience.</p>
                  </div>
                  <div className="h-px bg-slate-100 flex-1 mx-12 hidden lg:block mb-8"></div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Section 01 / Framework</p>
                  </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  {/* Geofence */}
                  <div className="p-12 rounded-[4rem] bg-white border border-slate-100 hover:shadow-[0_64px_128px_-32px_rgba(79,70,229,0.1)] transition-all duration-700 group">
                      <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-50 flex items-center justify-center mb-16 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-700 shadow-sm border border-indigo-100/50">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-12 h-12">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.03v.568c0 .334.148.65.405.864l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 0 1-1.161.886l-.143.048a1.107 1.107 0 0 0-.57 1.664c.369.555.169 1.307-.427 1.605L9 13.125l.423 1.059a.956.956 0 0 1-1.652.928l-.679-.906a1.125 1.125 0 0 0-1.906.17l-.272.68a1.125 1.125 0 0 1-2.038.114l-.271-.542a1.125 1.125 0 0 0-1.748-.414l-.25.194A10.5 10.5 0 0 1 12 1.5c.34 0 .676.016 1.007.048Zm5.474 1.651a10.5 10.5 0 0 1 3.519 5.818M11.512 21.001a10.5 10.5 0 0 1-5.112-2.585l.135-.113a1.125 1.125 0 0 1 1.411-.027l1.069.891a1.125 1.125 0 0 0 1.442 0l.443-.369a1.125 1.125 0 0 0 0-1.732l-1.07-.891a1.125 1.125 0 0 1-.442-1.442l.369-.443a1.125 1.125 0 0 1 1.732 0l.89 1.07a1.125 1.125 0 0 0 1.442 0l.369-.443a1.125 1.125 0 0 1 1.442 0l.891 1.07a1.125 1.125 0 0 0 1.732 0l.369-.443a1.125 1.125 0 0 1 1.442 0l.89 1.07a1.125 1.125 0 0 0 1.442 0l.135.113a10.502 10.502 0 0 1-2.518 5.613l-.135-.113a1.125 1.125 0 0 0-1.442 0l-.443.369a1.125 1.125 0 0 0 0 1.732l.135.113a10.45 10.45 0 0 1-3.518 1.651v-.568c0-.334-.148-.65-.405-.864l-1.069-.89a1.125 1.125 0 0 0-1.442 0l-.442.369a1.125 1.125 0 0 0 0 1.732l.135.113c-.331.032-.667.048-1.007.048Z" />
                        </svg>
                      </div>
                      <h3 className="text-3xl font-black mb-8 text-slate-900 leading-tight">Geofence <br/>Lockdown</h3>
                      <p className="text-slate-400 leading-relaxed font-medium">Real-time GPS validation restricts check-ins to absolute physical coordinates. Proximity isn't enough—presence is required.</p>
                  </div>

                  {/* Security */}
                  <div className="p-12 rounded-[4rem] bg-white border border-slate-100 hover:shadow-[0_64px_128px_-32px_rgba(244,63,94,0.1)] transition-all duration-700 group md:translate-y-12">
                      <div className="w-24 h-24 rounded-[2.5rem] bg-rose-50 flex items-center justify-center mb-16 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-all duration-700 shadow-sm border border-rose-100/50">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-12 h-12">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.744c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                        </svg>
                      </div>
                      <h3 className="text-3xl font-black mb-8 text-slate-900 leading-tight">Ephemeral <br/>Tokens</h3>
                      <p className="text-slate-400 leading-relaxed font-medium">Verification keys and QR structures rotate dynamically to eliminate credential sharing and ensure one-to-one identity integrity.</p>
                  </div>

                  {/* Analytics */}
                  <div className="p-12 rounded-[4rem] bg-white border border-slate-100 hover:shadow-[0_64px_128px_-32px_rgba(16,185,129,0.1)] transition-all duration-700 group">
                      <div className="w-24 h-24 rounded-[2.5rem] bg-emerald-50 flex items-center justify-center mb-16 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-700 shadow-sm border border-emerald-100/50">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-12 h-12">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
                         </svg>
                      </div>
                      <h3 className="text-3xl font-black mb-8 text-slate-900 leading-tight">Intelligence <br/>Metrics</h3>
                      <p className="text-slate-400 leading-relaxed font-medium">Faculty dashboards provide real-time engagement telemetry, automated reporting, and historical trend analysis in one unified interface.</p>
                  </div>
              </div>
           </div>
        </section>

        {/* System Trust Section */}
        <section className="py-32 px-6 bg-slate-950 text-white relative">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.15),transparent_70%)]"></div>
            <div className="max-w-7xl mx-auto relative z-10 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-10">Infrastructure Stack</p>
                <h3 className="text-4xl md:text-5xl font-black tracking-tighter mb-20 leading-tight">Secured by Industry-Leading <br/>Institutional Technology.</h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-12 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                    <div className="flex flex-col items-center gap-4">
                        <span className="text-2xl font-black tracking-tighter">APPWRITE.</span>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-indigo-300">Core Engine</span>
                    </div>
                    <div className="flex flex-col items-center gap-4">
                        <span className="text-2xl font-black tracking-tighter">GPS/GLO.</span>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-indigo-300">Spatial Node</span>
                    </div>
                    <div className="flex flex-col items-center gap-4">
                        <span className="text-2xl font-black tracking-tighter">AES-256.</span>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-indigo-300">Security Layer</span>
                    </div>
                    <div className="flex flex-col items-center gap-4">
                        <span className="text-2xl font-black tracking-tighter">REACT.</span>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-indigo-300">Interface</span>
                    </div>
                </div>
            </div>
        </section>

        {/* Footer */}
        <footer className="py-20 px-8 bg-white border-t border-slate-50 relative">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
                <div className="flex flex-col items-center md:items-start gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white">
                           <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337a49.94 49.94 0 0 0-9.9 2.133V19a.75.75 0 0 1-1.44 0v-6.805a49.94 49.94 0 0 0-9.9-2.133.75.75 0 0 1-.231-1.337A60.65 60.65 0 0 1 11.7 2.805Z" /></svg>
                        </div>
                        <span className="text-2xl font-black tracking-tighter">HIA</span>
                    </div>
                    <p className="text-slate-400 text-sm font-medium">Establish higher standards in institutional presence.</p>
                </div>
                
                <div className="text-center md:text-right space-y-4">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-300">&copy; {new Date().getFullYear()} Institutional Node</p>
                    <div className="flex gap-6 justify-center md:justify-end text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <a href="#" className="hover:text-indigo-600 transition-colors">Security Registry</a>
                        <a href="#" className="hover:text-indigo-600 transition-colors">Terminus Protocol</a>
                    </div>
                </div>
            </div>
        </footer>

      </div>
    </div>
  );
};

export default Home;

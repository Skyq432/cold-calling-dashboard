import React, { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line
} from "recharts";


// --- Type Definitions ---
type OtherStatusKey = 'untouched' | 'didNotPick' | 'notInterested' | 'dealLost';
type FunnelStageKey = 'callsConnected' | 'linkShared' | 'followUpCalls' | 'needsAssessment' | 'proposalsSent' | 'meetingsBooked' | 'dealsClosed';
type LeadStatusKey = OtherStatusKey | FunnelStageKey;

type ActivityStatus = 'Pending' | 'Completed';
type Activity = { id: number; task: string; dueDate: string; status: ActivityStatus };
type Note = { id: number; text: string; date: string; };
type Lead = {
    id: number;
    name: string;
    company: string;
    phone: string;
    status: LeadStatusKey;
    notes: Note[];
    activities: Activity[];
    statusHistory: { status: LeadStatusKey; date: string; }[];
};

// --- INITIAL DATA (Starts empty, ready for user upload) ---
const INITIAL_LEADS: Lead[] = [];

// --- Constants ---
const FUNNEL_STAGES_MAP: Record<FunnelStageKey, string> = {
  "callsConnected": "Connected", "linkShared": "Link Shared", "followUpCalls": "Follow-Up", "needsAssessment": "Assessment", "proposalsSent": "Proposals Sent", "meetingsBooked": "Meetings Booked", "dealsClosed": "Clients",
};
const OTHER_STATUSES_MAP: Record<OtherStatusKey, string> = {
    "untouched": "Untouched", "didNotPick": "Did Not Pick", "notInterested": "Not Interested", "dealLost": "Deal Lost"
};
const ALL_STATUSES_MAP: Record<LeadStatusKey, string> = { ...OTHER_STATUSES_MAP, ...FUNNEL_STAGES_MAP };
const FUNNEL_STAGES = Object.entries(FUNNEL_STAGES_MAP).map(([key, label]) => ({ key: key as FunnelStageKey, label }));
const CHART_COLORS = ["#0284c7", "#0d9488", "#4d7c0f", "#eab308", "#ea580c", "#be123c", "#4c1d95"];


// --- Helper Functions ---
function pct(n: number, d: number) { if (!d) return "0.0%"; return `${((n / d) * 100).toFixed(1)}%`; }

function getWeekNumber(d: Date) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    return `W${weekNo}`;
}


// --- SVG Icons ---
const PhoneIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-sky-500"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>);
const TrophyIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-emerald-500"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>);
const UsersIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-teal-500"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>);
const ChecklistIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="m9 14 2 2 4-4"></path></svg>);
const TargetIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>);
const ThumbsDownIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-rose-500"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// const SettingsIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-slate-500"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>);
const UploadIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>);
const SearchIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>);

// --- Reusable Components ---
const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className = "", children }) => (<div className={`rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/40 ${className}`}>{children}</div>);
const CardHeader: React.FC<React.PropsWithChildren<{ title: string; subtitle?: string, children?: React.ReactNode }>> = ({ title, subtitle, children }) => (<div className="flex items-start justify-between border-b border-slate-200 p-4"><div className="flex-1"><h3 className="text-base font-semibold tracking-tight text-slate-800">{title}</h3>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>{children}</div>);
const CardContent: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className = "", children }) => (<div className={`p-4 ${className}`}>{children}</div>);
const KpiCard: React.FC<{title: string; value: string; rateText: string; icon: React.ReactNode}> = ({ title, value, rateText, icon }) => {
    return (<Card><CardContent className="flex flex-col gap-2"><div className="flex items-center justify-between text-slate-500"><p className="text-sm font-medium">{title}</p>{icon}</div><p className="text-3xl font-bold text-slate-800">{value}</p><p className="text-xs text-slate-500">{rateText}</p></CardContent></Card>);
}

// --- Dashboard 1: Reporting ---
const ReportingDashboard = ({ leads }: { leads: Lead[] }) => {
    const [dateFilter, setDateFilter] = useState('month');
    const [progressView, setProgressView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [analysisView, setAnalysisView] = useState<'progress' | 'time'>('progress');
    const today = new Date();

    const filteredLeads = useMemo(() => {
        if (dateFilter === 'all') return leads;

        const filterDate = new Date();
        if (dateFilter === 'today') {
            filterDate.setHours(0, 0, 0, 0);
        } else if (dateFilter === '7d') {
            filterDate.setDate(filterDate.getDate() - 7);
        } else if (dateFilter === 'month') {
            filterDate.setDate(1); 
            filterDate.setHours(0,0,0,0);
        }

        return leads.filter(lead => {
            return lead.statusHistory.some(h => new Date(h.date) >= filterDate && new Date(h.date) <= today);
        });
    }, [leads, dateFilter, today]);

    const kpiData = useMemo(() => {
        const data = { totalDials: 0, totalConnected: 0, totalClients: 0, totalDealsLost: 0, };
        filteredLeads.forEach(lead => {
            if (lead.statusHistory.length > 0) data.totalDials += 1;
            if (lead.statusHistory.some(h => h.status === 'callsConnected')) data.totalConnected += 1;
            if (lead.status === 'dealsClosed') data.totalClients += 1;
            if (lead.status === 'dealLost') data.totalDealsLost += 1;
        });
        return data;
    }, [filteredLeads]);
    
    const funnelData = useMemo(() => {
       return FUNNEL_STAGES.map(({ key, label }) => {
           const count = filteredLeads.filter(lead => lead.statusHistory.some(h => h.status === key)).length;
           return { name: label, value: count };
       });
    }, [filteredLeads]);

    const velocityData = useMemo(() => {
        const stageCounts = FUNNEL_STAGES.reduce((acc, stage) => {
            acc[stage.key] = filteredLeads.filter(l => l.statusHistory.some(h => h.status === stage.key)).length;
            return acc;
        }, {} as Record<FunnelStageKey, number>);

        const totalConnected = stageCounts['callsConnected'];

        return FUNNEL_STAGES.slice(1).map(stage => {
            const leadsInThisStage = filteredLeads.filter(l => l.statusHistory.some(h => h.status === stage.key));
            
            const totalInThisStage = stageCounts[stage.key];
            
            const totalDays = leadsInThisStage.reduce((acc, lead) => {
                const connectedEntry = lead.statusHistory.find(h => h.status === 'callsConnected');
                const stageEntry = lead.statusHistory.find(h => h.status === stage.key);
                if (connectedEntry && stageEntry) {
                    const diffTime = Math.abs(new Date(stageEntry.date).getTime() - new Date(connectedEntry.date).getTime());
                    return acc + (diffTime / (1000 * 60 * 60 * 24));
                }
                return acc;
            }, 0);
            
            const conversionRate = pct(totalInThisStage, totalConnected);
            const currentCount = filteredLeads.filter(l => l.status === stage.key).length;
            
            return {
                key: stage.key,
                label: stage.label,
                avgDays: totalInThisStage > 0 ? totalDays / totalInThisStage : 0,
                conversionRate,
                currentCount
            };
        });
    }, [filteredLeads]);
    
    const timeAnalysisData = useMemo(() => {
        const hourlyData = Array.from({ length: 24 }, (_, i) => {
            const hour = i % 12 === 0 ? 12 : i % 12;
            const ampm = i < 12 ? 'AM' : 'PM';
            return { name: `${hour} ${ampm}`, conversions: 0 };
        });

        filteredLeads.forEach(lead => {
            lead.statusHistory.forEach(historyItem => {
                const conversionDate = new Date(historyItem.date);
                const hour = conversionDate.getHours(); 
                if (hourlyData[hour]) {
                    hourlyData[hour].conversions += 1;
                }
            });
        });

        return hourlyData;
    }, [filteredLeads]);
    
    const progressChartData = useMemo(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const groupedData: { [key: string]: any } = {};

        filteredLeads.forEach(lead => {
            lead.statusHistory.forEach(h => {
                const date = new Date(h.date);
                let key = '';

                if (progressView === 'daily') {
                    key = date.toLocaleDateString('en-CA');
                } else if (progressView === 'weekly') {
                    key = getWeekNumber(date);
                } else {
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                }

                if (!groupedData[key]) {
                    groupedData[key] = { time: key };
                    FUNNEL_STAGES.forEach(stage => {
                        groupedData[key][stage.label] = 0;
                    });
                }
                
                const stageLabel = FUNNEL_STAGES_MAP[h.status as FunnelStageKey];
                if(stageLabel) {
                   groupedData[key][stageLabel] = (groupedData[key][stageLabel] || 0) + 1;
                }
            });
        });
        
        return Object.values(groupedData).sort((a, b) => a.time.localeCompare(b.time)).map(d => {
            if (progressView === 'daily') {
                const date = new Date(d.time);
                 d.time = date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
            } else if (progressView === 'monthly') {
                 const [year, month] = d.time.split('-');
                 d.time = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('en-GB', { month: 'long' });
            }
            return d;
        });

    }, [filteredLeads, progressView]);


    return <>
        <div className="mb-4 flex justify-end">
            <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
                {(['today', '7d', 'month', 'all']).map(filter => (
                    <button key={filter} onClick={() => setDateFilter(filter)} className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${dateFilter === filter ? 'bg-white text-sky-600 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700'}`}>
                        {filter === 'today' ? 'Today' : filter === '7d' ? 'Last 7 Days' : filter === 'month' ? 'This Month' : 'All Time'}
                    </button>
                ))}
            </div>
        </div>
        <section className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Total Dials" value={kpiData.totalDials.toLocaleString()} rateText="Leads contacted" icon={<PhoneIcon />}/>
            <KpiCard title="Calls Connected" value={kpiData.totalConnected.toLocaleString()} rateText={`Connection Rate: ${pct(kpiData.totalConnected, kpiData.totalDials)}`} icon={<UsersIcon />}/>
            <KpiCard title="Clients" value={kpiData.totalClients.toLocaleString()} rateText="Total acquired clients" icon={<TrophyIcon />}/>
            <KpiCard title="Deals Lost" value={kpiData.totalDealsLost.toLocaleString()} rateText="Total lost deals" icon={<ThumbsDownIcon />}/>
        </section>
        <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
                <CardHeader title="Sales Conversion Funnel" subtitle="Conversion from 'Connected'" />
                <CardContent>
                    <div className="flex flex-col items-center">
                        {funnelData.map((stage, index) => {
                             const topWidth = 100 - index * 12;
                             const bottomWidth = 100 - (index + 1) * 12;
                             const clipPathStyle = `polygon(${(100 - topWidth) / 2}% 0, ${(100 + topWidth) / 2}% 0, ${(100 + bottomWidth) / 2}% 100%, ${(100 - bottomWidth) / 2}% 100%)`;

                             const connectedValue = funnelData[0].value;
                             const conversion = index > 0 ? pct(stage.value, connectedValue) : '100.0%';

                             if (stage.value === 0 && index > 0) return null;

                             return (
                                <div key={stage.name}
                                     className="relative h-12 text-white font-semibold flex items-center justify-center w-full drop-shadow-md"
                                     style={{
                                         backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                                         clipPath: clipPathStyle,
                                     }}>
                                    <div className="flex flex-col text-center text-sm leading-tight">
                                        <span>{stage.name}</span>
                                        <div className="text-xs font-normal">
                                            <span className="font-semibold">{stage.value.toLocaleString()}</span>
                                            {index > 0 && <span className="ml-1.5 opacity-80">({conversion})</span>}
                                        </div>
                                    </div>
                                </div>
                             );
                        })}
                    </div>
                </CardContent>
            </Card>
            <Card className="lg:col-span-3">
                 <CardHeader title="Sales Velocity & Conversion" subtitle="Avg. time from 'Connected' and stage conversion" />
                 <CardContent>
                     <div className="space-y-4">
                         {velocityData.map((stage, i) => (
                             <div key={stage.key} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
                                 <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="h-3 w-3 rounded-full mr-3" style={{backgroundColor: CHART_COLORS[i+1]}}></div>
                                        <span className="font-semibold text-slate-800 text-sm">{stage.label}</span>
                                    </div>
                                    <span className="font-bold text-slate-800 text-sm">{stage.avgDays.toFixed(1)} days</span>
                                 </div>
                                 <div className="flex justify-between items-center text-xs text-slate-500 pl-6">
                                     <span>Conversion from Connected: <span className="font-medium text-slate-600">{stage.conversionRate}</span></span>
                                     <span>Leads currently in stage: <span className="font-medium text-slate-600">{stage.currentCount}</span></span>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </CardContent>
            </Card>
        </section>
        <section className="mt-6">
            <Card>
                <CardHeader 
                    title="Performance Analysis"
                    subtitle={analysisView === 'progress' ? "Lead progression over time" : "Peak conversion hours"}
                >
                    <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
                        <button onClick={() => setAnalysisView('progress')} className={`capitalize rounded-md px-3 py-1 text-xs font-semibold transition-colors ${analysisView === 'progress' ? 'bg-white text-sky-600 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700'}`}>
                            Progress
                        </button>
                        <button onClick={() => setAnalysisView('time')} className={`capitalize rounded-md px-3 py-1 text-xs font-semibold transition-colors ${analysisView === 'time' ? 'bg-white text-sky-600 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700'}`}>
                            Time
                        </button>
                    </div>
                </CardHeader>
                <CardContent>
                    {analysisView === 'progress' && (
                        <>
                            <div className="mb-4 flex justify-end">
                                <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
                                    {(['daily', 'weekly', 'monthly'] as const).map(view => (
                                        <button key={view} onClick={() => setProgressView(view)} className={`capitalize rounded-md px-3 py-1 text-xs font-semibold transition-colors ${progressView === view ? 'bg-white text-sky-600 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700'}`}>
                                            {view}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="h-96 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={progressChartData} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                        <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#64748b" />
                                        <YAxis tick={{ fontSize: 12 }} stroke="#64748b" allowDecimals={false} />
                                        <Tooltip />
                                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: '20px' }}/>
                                        {FUNNEL_STAGES.map((stage, index) => (
                                            <Line key={stage.key} type="monotone" dataKey={stage.label} stroke={CHART_COLORS[index]} strokeWidth={2} dot={false} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </>
                    )}
                     {analysisView === 'time' && (
                        <div className="h-96 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={timeAnalysisData}
                                    margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" interval={1} />
                                    <YAxis tick={{ fontSize: 12 }} stroke="#64748b" allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#fff',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '0.5rem',
                                            fontSize: '12px',
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                    <Bar dataKey="conversions" name="Conversion Events" fill={CHART_COLORS[0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                     )}
                </CardContent>
            </Card>
        </section>
    </>
}

// --- Dashboard 2: Lead Management ---
const LeadManagementDashboard = ({ leads, setLeads }: { leads: Lead[], setLeads: React.Dispatch<React.SetStateAction<Lead[]>> }) => {
    const [callState, setCallState] = useState<{ status: 'idle' | 'dialing' | 'connected', leadId: number | null, startTime: number | null, duration: number }>({ status: 'idle', leadId: null, startTime: null, duration: 0 });
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [namesVisible, setNamesVisible] = useState(true);
    const [isCallingSessionActive, setIsCallingSessionActive] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
      let timer: ReturnType<typeof setTimeout>;
        if (callState.status === 'connected' && callState.startTime) {
            timer = setInterval(() => { setCallState(cs => ({ ...cs, duration: Date.now() - (cs.startTime ?? 0) })); }, 1000);
        }
        return () => clearInterval(timer);
    }, [callState.status, callState.startTime]);

    const handleStartCall = (leadId: number) => { 
        const lead = leads.find(l => l.id === leadId);
        if (lead && lead.phone) {
            window.location.href = `tel:${lead.phone}`;
        }
        setCallState({ status: 'dialing', leadId, startTime: null, duration: 0 }); 
    };
    
    const handleCallConnected = () => {
        setCallState(cs => ({ ...cs, status: 'connected', startTime: Date.now() }));
    };

    const handleQuickUpdate = (newStatus: 'didNotPick' | 'notInterested') => {
        if (!callState.leadId) return;
        setLeads(prev => prev.map(lead => lead.id === callState.leadId ? {
            ...lead,
            status: newStatus,
            statusHistory: [...lead.statusHistory, { status: newStatus, date: new Date().toISOString() }]
        } : lead));
        setCallState({ status: 'idle', leadId: null, startTime: null, duration: 0 });
    };
    
    const currentCallLead = useMemo(() => leads.find(l => l.id === callState.leadId), [leads, callState.leadId]);
    
    const handleEndCall = () => { 
        setCallState(cs => ({ ...cs, status: 'idle' }));
        setSelectedLead(currentCallLead || null);
    };

    const handleSaveInteraction = (leadId: number, data: { name: string; company: string; phone: string; notes: string; newStatus: LeadStatusKey; nextActivityTask?: string; nextActivityDueDate?: string; }) => {
        setLeads(prevLeads => prevLeads.map(lead => {
            if (lead.id !== leadId) return lead;
            
            const newStatusHistory = lead.status !== data.newStatus
                ? [...lead.statusHistory, { status: data.newStatus, date: new Date().toISOString() }]
                : lead.statusHistory;

            const updatedLead = { ...lead, name: data.name, company: data.company, phone: data.phone, status: data.newStatus, statusHistory: newStatusHistory };

            if (data.notes.trim()) {
                const newNote: Note = { id: Date.now(), text: data.notes, date: new Date().toISOString() };
                updatedLead.notes = [newNote, ...lead.notes];
            }

            if (data.nextActivityTask && data.nextActivityDueDate) {
                const newActivity: Activity = {
                    id: Date.now() + 1,
                    task: data.nextActivityTask,
                    dueDate: data.nextActivityDueDate,
                    status: 'Pending'
                };
                updatedLead.activities = [newActivity, ...lead.activities];
            }
            return updatedLead;
        }));
        setSelectedLead(null);
        setCallState({ status: 'idle', leadId: null, startTime: null, duration: 0 });
        setIsCallingSessionActive(true); 
    };

    const handleCompleteActivity = (activityId: number) => {
        setLeads(prevLeads => prevLeads.map(lead => ({ ...lead, activities: lead.activities.map(act => act.id === activityId ? { ...act, status: 'Completed' } : act) })));
    };
    
    const today = new Date().toISOString().split('T')[0];
    const dueActivities = useMemo(() => {
        return leads.flatMap(lead => lead.activities.map(act => ({...act, lead}))).filter(act => act.status === 'Pending' && act.dueDate <= today).sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [leads, today]);
    
    const nextUntouchedLead = useMemo(() => leads.find(lead => lead.status === 'untouched'), [leads]);
    
    const filteredLeadsList = useMemo(() => {
        return leads.filter(lead => {
            const searchMatch = !searchTerm || 
                lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lead.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                `LEAD-${String(lead.id).padStart(3, '0')}`.toLowerCase().includes(searchTerm.toLowerCase());
            
            const statusMatch = statusFilter === 'all' || lead.status === statusFilter;

            return searchMatch && statusMatch;
        });
    }, [leads, searchTerm, statusFilter]);

    return <>
        <section className="mb-6">
            <Card>
                <CardHeader title="Action Hub" subtitle="Your next recommended actions" />
                <CardContent className="space-y-4">
                     {callState.status !== 'idle' && currentCallLead ? (
                        <div className="flex flex-col items-center justify-center rounded-lg bg-sky-50 p-6 text-center">
                            <p className="text-sm font-medium text-sky-700">
                                {callState.status === 'dialing' ? 'Dialing...' : 'Connected with'}
                            </p>
                            <p className="text-xl font-bold text-sky-900">{currentCallLead.name}</p>
                            <p className="text-sm text-slate-600 mt-1">{currentCallLead.company}</p>
                            <a href={`tel:${currentCallLead.phone}`} className="text-sm font-mono text-sky-600 hover:underline">{currentCallLead.phone}</a>
                            
                            {callState.status === 'connected' && (
                                <p className="text-lg font-mono text-sky-900 mt-2">{new Date(callState.duration).toISOString().substr(14, 5)}</p>
                            )}

                            {callState.status === 'dialing' && (
                                <div className="mt-4 grid grid-cols-2 gap-3 w-full max-w-sm">
                                    <button onClick={() => handleQuickUpdate('didNotPick')} className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm hover:bg-amber-200">No Answer</button>
                                    <button onClick={handleCallConnected} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">Connected</button>
                                </div>
                            )}

                            {callState.status === 'connected' && (
                                <button onClick={handleEndCall} className="mt-4 rounded-full bg-rose-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700">End & Log Call</button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 divide-x divide-slate-200/60">
                            {/* Due Activities */}
                            <div className="pr-4">
                                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Due Activities ({dueActivities.length})</h4>
                                {dueActivities.length > 0 ? (
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                    {dueActivities.map(activity => (
                                         <div key={activity.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-md">
                                            <div className="flex items-center"><ChecklistIcon/><div>
                                                <p className="font-semibold text-slate-800 text-sm">{activity.task}</p>
                                                <p className="text-xs text-slate-500">For: {activity.lead.name}</p>
                                            </div></div>
                                            <button onClick={() => handleCompleteActivity(activity.id)} className="rounded-md bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200">Done</button>
                                        </div>
                                    ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-sm text-slate-500 py-8">No activities due today!</p>
                                )}
                            </div>

                            {/* New Leads */}
                             <div className="pl-4">
                                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">New Leads</h4>
                                {!nextUntouchedLead ? <p className="text-center text-sm text-slate-500 py-8">No untouched leads left!</p> :
                                isCallingSessionActive ? (
                                    <div className="flex items-center justify-between p-2">
                                        <div className="flex items-center"><TargetIcon/><div>
                                            <p className="font-semibold text-slate-800">Call {nextUntouchedLead.name}</p>
                                            <p className="text-xs text-slate-500">Company: {nextUntouchedLead.company}</p>
                                        </div></div>
                                        <button onClick={() => handleStartCall(nextUntouchedLead.id)} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700">Start Call</button>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <button onClick={() => setIsCallingSessionActive(true)} className="rounded-full bg-sky-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700">Start Calling Session</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </section>

        <section>
             <Card>
                <CardHeader title="Current Leads" subtitle="All prospects">
                     <div className="flex flex-wrap items-center gap-4">
                        <div className="relative">
                           <SearchIcon />
                           <input 
                              type="text" 
                              placeholder="Search..."
                              value={searchTerm}
                              onChange={e => setSearchTerm(e.target.value)}
                              className="w-full rounded-md border-slate-300 pl-9 text-sm focus:border-sky-500 focus:ring-sky-500"
                           />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="rounded-md border-slate-300 text-sm focus:border-sky-500 focus:ring-sky-500"
                        >
                            <option value="all">All Statuses</option>
                            {Object.entries(ALL_STATUSES_MAP).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                        <button onClick={() => setNamesVisible(!namesVisible)} className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
                            {namesVisible ? 'Hide' : 'Show'}
                        </button>
                     </div>
                </CardHeader>
                <CardContent className="!p-0">
                    <div className="divide-y divide-slate-200 max-h-[50vh] overflow-y-auto">
                       {filteredLeadsList.map(lead => (
                            <div key={lead.id} className="flex items-center justify-between py-3 px-4">
                                <div>
                                    <p className="font-medium text-slate-800">
                                        <span className="text-xs font-mono text-slate-400 mr-2">LEAD-{String(lead.id).padStart(3, '0')}</span>
                                        {namesVisible ? lead.name : <span className="italic text-slate-500">[Details Hidden]</span>}
                                    </p>
                                    {namesVisible && (
                                        <p className="text-xs text-slate-500 ml-[68px]">{lead.company} · {lead.phone}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`hidden sm:inline-block rounded-full px-3 py-1 text-xs font-semibold w-28 text-center ${lead.status in OTHER_STATUSES_MAP ? 'bg-slate-100 text-slate-700' : 'bg-sky-100 text-sky-700'}`}>
                                        {ALL_STATUSES_MAP[lead.status]}
                                    </span>
                                    <button onClick={() => setSelectedLead(lead)} className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">View</button>
                                </div>
                            </div>
                       ))}
                    </div>
                </CardContent>
            </Card>
        </section>

        <LeadDetailModal isOpen={!!selectedLead} onClose={() => setSelectedLead(null)} lead={selectedLead} onSave={handleSaveInteraction} />
    </>;
}

// --- Dashboard 3: Settings ---
const SettingsDashboard = ({ setLeads }: { setLeads: React.Dispatch<React.SetStateAction<Lead[]>> }) => {
    const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);
    const fileInputRef = React.createRef<HTMLInputElement>();

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFeedback(null);
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                if (!text) {
                     throw new Error("File is empty.");
                }

                const rows = text.trim().split(/\r?\n/);
                const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
                const requiredHeaders = ['name', 'company', 'phone'];
                if(!requiredHeaders.every(h => headers.includes(h))) {
                    throw new Error(`CSV must contain the following headers: ${requiredHeaders.join(', ')}`);
                }

                
                const newLeads: Lead[] = rows.slice(1)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .map((row, index) => {
    if (!row.trim()) return null; // Skip empty rows

    const values = row.split(',');

    const leadObject = headers.reduce<Record<string, string>>((obj, header, i) => {
      obj[header] = values[i] ? values[i].trim() : '';
      return obj;
    }, {});

    return {
      id: Date.now() + 1,
      name: leadObject.name || 'N/A',
      company: leadObject.company || 'N/A',
      phone: leadObject.phone || 'N/A',
      status: 'untouched',
      notes: [],
      activities: [],
      statusHistory: [],
    } as Lead;
  })
  .filter((lead): lead is Lead => lead !== null);

                if (newLeads.length === 0) {
                     throw new Error("No valid lead data found in the file.");
                }

                setLeads(newLeads); // This replaces the old leads
                setFeedback({type: 'success', message: `Successfully uploaded ${newLeads.length} new leads. Old data has been replaced.`});

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                setFeedback({type: 'error', message: `Upload Failed: ${err.message}`});
            } finally {
                // Reset file input
                if(fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        };

        reader.readAsText(file);
    };

    return (
        <div className="grid grid-cols-1 gap-6">
            <Card>
                <CardHeader title="Upload New Leads" subtitle="Replace all existing leads with a .csv file" />
                <CardContent>
                    <p className="text-xs text-slate-500 mb-4">
                        Ensure your CSV has columns named `name`, `company`, and `phone`. The `id` and `status` will be set automatically.
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center rounded-full border border-transparent bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm hover:bg-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
                    >
                        <UploadIcon />
                        Upload .csv File
                    </button>
                     {feedback && (
                        <div className={`mt-4 text-sm rounded-md p-3 ${feedback.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {feedback.message}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
// --- Modals ---
const LeadDetailModal = ({ lead, isOpen, onClose, onSave }: { lead: Lead | null; isOpen: boolean; onClose: () => void; onSave: (leadId: number, data: { name: string; company: string; phone: string; notes: string; newStatus: LeadStatusKey; nextActivityTask?: string; nextActivityDueDate?: string; }) => void; }) => {
    const [notes, setNotes] = useState('');
    const [newStatus, setNewStatus] = useState<LeadStatusKey | undefined>(lead?.status);
    const [nextTask, setNextTask] = useState('');
    const [nextDueDate, setNextDueDate] = useState('');
    const [editedName, setEditedName] = useState('');
    const [editedCompany, setEditedCompany] = useState('');
    const [editedPhone, setEditedPhone] = useState('');

    useEffect(() => { 
        if (lead) {
            setNewStatus(lead.status);
            setNotes('');
            setNextTask('');
            setNextDueDate('');
            setEditedName(lead.name);
            setEditedCompany(lead.company);
            setEditedPhone(lead.phone);
        }
    }, [lead]);

    if (!isOpen || !lead) return null;

    const handleSave = () => {
        onSave(lead.id, { name: editedName, company: editedCompany, phone: editedPhone, notes, newStatus: newStatus || lead.status, nextActivityTask: nextTask, nextActivityDueDate: nextDueDate });
    };
    
    const availableStatuses = Object.entries(ALL_STATUSES_MAP).filter(([key]) => key !== 'untouched');

    return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity">
        <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl m-4">
            <CardHeader title={`Editing Lead: LEAD-${String(lead.id).padStart(3, '0')}`}>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
            </CardHeader>
            <div className="p-6 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Left side: Edit Details & Log Interaction */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-slate-800 border-b pb-2 mb-3">Lead Information</h3>
                        <div>
                            <label htmlFor="lead-name" className="text-sm font-medium text-slate-700">Name</label>
                            <input type="text" id="lead-name" value={editedName} onChange={e => setEditedName(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm" />
                        </div>
                         <div>
                            <label htmlFor="lead-company" className="text-sm font-medium text-slate-700">Company / Workplace</label>
                            <input type="text" id="lead-company" value={editedCompany} onChange={e => setEditedCompany(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm" />
                        </div>
                         <div>
                            <label htmlFor="lead-phone" className="text-sm font-medium text-slate-700">Phone Number</label>
                            <input type="text" id="lead-phone" value={editedPhone} onChange={e => setEditedPhone(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm" />
                        </div>
                        
                        <h3 className="text-sm font-semibold text-slate-800 border-b pb-2 mb-3 pt-4">Log New Interaction</h3>
                        <div>
                            <label htmlFor="notes" className="text-sm font-medium text-slate-700">Notes</label>
                            <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm" placeholder="e.g., Discussed pricing..."></textarea>
                        </div>
                        <div>
                            <label htmlFor="funnel-stage" className="text-sm font-medium text-slate-700">Update Status</label>
                            <select id="funnel-stage" value={newStatus} onChange={(e) => setNewStatus(e.target.value as LeadStatusKey)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm">
                              {availableStatuses.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select>
                        </div>
                    </div>
                    {/* Right side: History & Next Activity */}
                    <div className="space-y-4">
                         <h3 className="text-sm font-semibold text-slate-800 border-b pb-2 mb-3">Schedule Next Activity</h3>
                         <div>
                            <label htmlFor="next-task" className="text-sm font-medium text-slate-700">Task</label>
                            <input type="text" id="next-task" value={nextTask} onChange={e => setNextTask(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm" placeholder="e.g., Send proposal"/>
                        </div>
                         <div>
                            <label htmlFor="next-due" className="text-sm font-medium text-slate-700">Due Date</label>
                            <input type="date" id="next-due" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"/>
                        </div>

                        <h3 className="text-sm font-semibold text-slate-800 border-b pb-2 mb-3 pt-4">History &amp; Upcoming</h3>
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                            {lead.activities.filter(a => a.status === 'Pending').map(act => <div key={act.id} className="text-xs p-2 rounded-md bg-amber-50 border border-amber-200">
                                <p className="font-semibold text-amber-800">{act.task}</p>
                                <p className="text-amber-600">Due: {new Date(act.dueDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                            </div>)}
                            {lead.notes.map(note => <div key={note.id} className="text-xs p-2 rounded-md bg-slate-50">
                                <p className="text-slate-600">{note.text}</p>
                                <p className="text-slate-400 text-right">{new Date(note.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>)}
                             {lead.activities.filter(a => a.status === 'Completed').map(act => <div key={act.id} className="text-xs p-2 rounded-md bg-emerald-50 text-emerald-600 line-through">
                                <p>{act.task}</p>
                            </div>)}
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 rounded-b-xl">
                <button onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">Cancel</button>
                <button onClick={handleSave} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700">Save Update</button>
            </div>
        </div>
    </div>);
};

// --- Main App Component (Controller) ---
export default function App() {
  const [activeTab, setActiveTab] = useState<'reporting' | 'leads' | 'settings'>('reporting');
  const [leads, setLeads] = useState<Lead[]>(() => {
    try {
      const savedLeads = localStorage.getItem('coldCallingLeads');
      // If there's saved data, use it. Otherwise, start with the INITIAL_LEADS from the file.
      return savedLeads ? JSON.parse(savedLeads) : INITIAL_LEADS;
    } catch (error) {
      console.error("Could not parse leads from localStorage", error);
      return INITIAL_LEADS;
    }
  });

  const [currentDate, setCurrentDate] = useState(new Date());

   // Update the current time every minute for live feeling
  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Effect to save leads to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('coldCallingLeads', JSON.stringify(leads));
    } catch (error) {
      console.error("Could not save leads to localStorage", error);
    }
  }, [leads]);


  const title = "Does Cold Calling Work in Nigeria?";
  const subtitle = "Target: Nigerian Auto Business Owners";

  return (
    <div className="min-h-screen w-full bg-slate-50 p-4 sm:p-6 text-slate-900 font-sans">
      <main className="mx-auto max-w-7xl">
        <header className="mb-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">{title}</h1>
            <p className="text-sm text-slate-600">{subtitle} · As of {currentDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}, {currentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })} WAT</p>
          </div>
          <div className="mt-4 border-b border-slate-200">
            <nav className="-mb-px flex space-x-6">
              <button
                onClick={() => setActiveTab('reporting')}
                className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${activeTab === 'reporting' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}
              >
                Reporting Dashboard
              </button>
              <button
                onClick={() => setActiveTab('leads')}
                className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${activeTab === 'leads' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}
              >
                Lead Management
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${activeTab === 'settings' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}
              >
                Settings
              </button>
            </nav>
          </div>
        </header>

        {activeTab === 'reporting' && <ReportingDashboard leads={leads} />}
        {activeTab === 'leads' && <LeadManagementDashboard leads={leads} setLeads={setLeads} />}
        {activeTab === 'settings' && <SettingsDashboard setLeads={setLeads} />}
      </main>
    </div>
  );
}


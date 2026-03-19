import React, { useState, useEffect } from 'react';
import { Plus, BarChart3, Search, Calendar, DollarSign, Building2, MoreHorizontal, X } from 'lucide-react';
import { api } from '../context/AuthContext';

// Enum string mapping defined in FastAPI backend (models.py)
const STAGES = [
  "Prospecting",
  "Qualification",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost"
];

// Map stages to Tailwind aesthetics for visual pipelining
const STAGE_COLORS = {
  "Prospecting": "border-slate-400 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  "Qualification": "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  "Proposal": "border-purple-400 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
  "Negotiation": "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  "Closed Won": "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  "Closed Lost": "border-red-400 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
};

const Opportunities = () => {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', amount: '', stage: 'Prospecting', expected_close_date: '' });

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const res = await api.get('/opportunities?limit=100'); // Bring enough payload to map to the board
      setOpportunities(res.data);
    } catch (err) {
      console.error("Failed to fetch opportunities pipeline:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const handleCreateOpportunity = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount) || 0,
        expected_close_date: formData.expected_close_date ? new Date(formData.expected_close_date).toISOString() : null
      };

      await api.post('/opportunities/', payload);
      setIsModalOpen(false);
      setFormData({ name: '', amount: '', stage: 'Prospecting', expected_close_date: '' });
      fetchOpportunities(); // refresh pipeline
    } catch (err) {
      console.error("Failed to create opportunity", err);
    }
  };

  // Helper arrays filtered per iteration for the logical column mapping
  const getOppsByStage = (stageName) => opportunities.filter(o => o.stage === stageName);

  // Helper formatting for deal valuations
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <BarChart3 className="text-crmAccent w-7 h-7" /> Sales Pipeline
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track and visually manage your opportunities progressing through the organization funnel.
          </p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-crmAccent hover:bg-crmHover text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-2 focus:ring-4 focus:ring-blue-500/20 active:scale-[0.98]"
        >
          <Plus size={18} /> New Deal
        </button>
      </div>

      {/* Horizontal Scrollable Kanban Container */}
      <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-64 w-full border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-crmAccent border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-500 font-medium tracking-wide">Rendering pipeline...</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 h-full min-w-max items-start">
            {STAGES.map(stage => {
              const stageOpps = getOppsByStage(stage);
              const stageColorClass = STAGE_COLORS[stage] || STAGE_COLORS["Prospecting"];
              
              // Calculates aggregate pipeline valuation per logic column
              const totalValue = stageOpps.reduce((sum, current) => sum + (current.amount || 0), 0);
              
              return (
                <div key={stage} className="w-[320px] flex-shrink-0 flex flex-col h-full bg-slate-100/60 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-colors">
                  
                  {/* Column Header */}
                  <div className={`p-4 border-b-[3px] rounded-t-xl ${stageColorClass.split(' ')[0]} bg-white dark:bg-crmCard sticky top-0 z-10 shadow-sm flex justify-between items-center transition-colors`}>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm uppercase tracking-wide">{stage}</h3>
                      <p className="text-xs font-semibold mt-1 text-slate-500 dark:text-slate-400">
                        {stageOpps.length} {stageOpps.length === 1 ? 'deal' : 'deals'} 
                        <span className="mx-1.5 opacity-50">•</span> 
                        <span className="text-slate-700 dark:text-slate-300">{formatCurrency(totalValue)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Vertikcal Cards Area */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-[500px]">
                    {stageOpps.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/20">
                        <p className="text-xs text-center text-slate-500 dark:text-slate-400 font-medium">Empty Stage</p>
                      </div>
                    ) : (
                      stageOpps.map(opp => (
                        <div 
                          key={opp.id} 
                          className="bg-white dark:bg-crmCard p-4 rounded-xl shadow-sm hover:shadow-md border border-slate-200 dark:border-slate-700 transition-all cursor-grab active:cursor-grabbing group hover:-translate-y-0.5"
                        >
                          <div className="flex justify-between items-start mb-2.5">
                            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 leading-tight pr-4">
                              {opp.name}
                            </h4>
                            <button className="text-slate-400 hover:text-crmAccent opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 -mr-1">
                              <MoreHorizontal size={16} />
                            </button>
                          </div>
                          
                          <div className="space-y-3">
                            {/* Embedded Amount Badge */}
                            <div className="flex items-center text-[13px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 w-fit px-2.5 py-1 rounded-md border border-emerald-100 dark:border-emerald-800/40">
                              {formatCurrency(opp.amount)}
                            </div>
                            
                            <div className="flex flex-col gap-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                              {/* Account Display Link */}
                              <div className="flex items-center text-xs text-slate-600 dark:text-slate-400 font-medium">
                                <Building2 size={13} className="mr-1.5 opacity-70" />
                                {opp.account_id ? `Account #${opp.account_id}` : 'Unassigned Account'}
                              </div>
                              
                              {/* Calculated Closing Date block */}
                              {opp.expected_close_date && (
                                <div className="flex items-center text-xs text-slate-600 dark:text-slate-400 font-medium">
                                  <Calendar size={13} className="mr-1.5 opacity-70" />
                                  Close: {new Date(opp.expected_close_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pop Up Deal Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white dark:bg-crmCard w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create Deal</h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-amber-200 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateOpportunity} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Deal Name <span className="text-red-500">*</span></label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all placeholder:text-slate-400"
                  placeholder="e.g. Acme Backend Architecture Expansion"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Est. Value ($)</label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all"
                      placeholder="120000"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Close target</label>
                  <input 
                    type="date" 
                    value={formData.expected_close_date}
                    onChange={(e) => setFormData({...formData, expected_close_date: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Pipeline Stage Placement</label>
                <select 
                  value={formData.stage}
                  onChange={(e) => setFormData({...formData, stage: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all cursor-pointer"
                >
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-crmAccent hover:bg-crmHover text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:ring-4 focus:ring-blue-500/30 active:scale-[0.98]"
                >
                  Push to Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Opportunities;

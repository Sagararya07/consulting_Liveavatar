"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { askQuery, getSettings, bookMeeting, initSession, type MeetingSlot } from "../lib/api";

export default function TextChatWidget() {
  const { user, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showPreChatForm, setShowPreChatForm] = useState(false);
  const [messages, setMessages] = useState<{role: "user" | "avatar", text: string}[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const conversationId = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [confirmSlot, setConfirmSlot] = useState<MeetingSlot | null>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
    company_name: "",
    role: "",
    company_website: "",
    location: "",
    num_employees: "",
    budget_range: "",
    industry_type: "",
    service_requirement: "",
    expected_timeline: ""
  });

  const handlePreChatSubmit = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await initSession("multi", formData as Record<string, string>, token);
      setShowPreChatForm(false);
      conversationId.current = res.conversation_id;
      setIsOpen(true);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize intro message
  useEffect(() => {
    if (isOpen && messages.length === 0 && conversationId.current) {
       const loadIntro = async () => {
         try {
           const settings = await getSettings();
           let intro = settings.avatar_intro || "Hello, how can I help you today?";
           intro = intro.replace("{user_name}", user?.name || "there");
           intro = intro.replace("{avatar_name}", settings.avatar_name || "Avor");
           setMessages([{role: "avatar", text: intro}]);
         } catch (e) {
           setMessages([{role: "avatar", text: `Hello ${user?.name || ''}, how may I assist you?`}]);
         }
       };
       loadIntro();
    }
  }, [isOpen, messages.length, user]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || !user || !token) return;
    const text = inputText.trim();
    setInputText("");
    setMessages(prev => [...prev, {role: "user", text}]);
    setLoading(true);

    try {
      const result = await askQuery(
        user.id,
        text,
        "multi", // default language code
        conversationId.current || undefined,
        token,
        Intl.DateTimeFormat().resolvedOptions().timeZone
      );
      
      if (result.conversation_id) {
        conversationId.current = result.conversation_id;
      }
      
      const newMessages = [{role: "avatar" as const, text: result.answer}];
      
      // Simulate UI Actions
      if (result.ui_action?.type === "show_slots" || result.ui_action?.type === "propose_oral_booking") {
        newMessages.push({role: "avatar", text: "📅 [Booking UI Triggered: Ready to book]"});
        if (result.ui_action.slot) {
          setConfirmSlot(result.ui_action.slot);
        } else if (result.ui_action.slots && result.ui_action.slots.length > 0) {
           // just take the first slot for testing
          setConfirmSlot(result.ui_action.slots[0]);
        }
      } else if (result.ui_action?.type === "slot_auto_booked") {
        newMessages.push({role: "avatar", text: "✅ [Slot Auto-Booked]"});
      }

      setMessages(prev => [...prev, ...newMessages]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {role: "avatar", text: "Sorry, I encountered an error. Please try again."}]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleBookSlotConfirm = async () => {
    if (!token || !conversationId.current || !confirmSlot || isSubmittingBooking) return;
    setIsSubmittingBooking(true);
    try {
      const result = await bookMeeting(token, {
        conversation_id: conversationId.current,
        slot_id: confirmSlot.id,
        slot_start: confirmSlot.start,
        slot_end: confirmSlot.end,
        timezone: confirmSlot.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        attendee_name: formData.name,
        attendee_email: formData.email,
        company_name: formData.company_name,
      });

      setConfirmSlot(null);
      setMessages(prev => [...prev, {role: "avatar", text: result.message}]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {role: "avatar", text: "Could not book that slot. Please try again."}]);
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={() => {
          if (!isOpen && !conversationId.current) {
            setShowPreChatForm(true);
          } else {
            setIsOpen(!isOpen);
          }
        }}
        style={styles.floatingBtn}
      >
        💬 Test Chat
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div style={styles.chatWindow}>
          <div style={styles.chatHeader}>
            <strong>Test Agent (No Credits)</strong>
            <button onClick={() => setIsOpen(false)} style={styles.closeBtn}>×</button>
          </div>
          <div style={styles.messageList}>
            {messages.map((m, i) => (
              <div key={i} style={{
                ...styles.messageBubble,
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: m.role === 'user' ? '#007bff' : '#444',
                color: '#fff'
              }}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div style={{...styles.messageBubble, alignSelf: 'flex-start', backgroundColor: '#444'}}>
                Typing...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div style={styles.inputArea}>
            <input 
              style={styles.input}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
            />
            <button onClick={sendMessage} style={styles.sendBtn} disabled={loading}>
              Send
            </button>
          </div>
        </div>
      )}

      {/* Booking Confirmation Modal inside the widget scope */}
      {confirmSlot && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h4>Confirm Booking</h4>
            <p style={{fontSize: '13px', marginBottom: '10px'}}>Slot: {confirmSlot.label}</p>
            <input style={styles.modalInput} placeholder="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <input style={styles.modalInput} placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            <input style={styles.modalInput} placeholder="Company" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} />
            <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
              <button onClick={() => setConfirmSlot(null)} style={{flex: 1, padding: '8px', background: '#444', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer'}}>Cancel</button>
              <button onClick={handleBookSlotConfirm} style={{flex: 1, padding: '8px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer'}} disabled={isSubmittingBooking}>
                {isSubmittingBooking ? "Booking..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Chat Form Modal */}
      {showPreChatForm && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modalContent, maxHeight: '90vh', overflowY: 'auto', width: '90%', maxWidth: '600px'}}>
            <h3 style={{marginTop: 0}}>Before we begin...</h3>
            <p style={{fontSize: '14px', color: '#ccc', marginBottom: '20px'}}>Please tell us a bit about yourself.</p>
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
              <div>
                <label style={{fontSize: '12px', color: '#aaa'}}>Name</label>
                <input type="text" style={styles.modalInput} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label style={{fontSize: '12px', color: '#aaa'}}>Business Mail</label>
                <input type="email" style={styles.modalInput} value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label style={{fontSize: '12px', color: '#aaa'}}>Phone</label>
                <input type="text" style={styles.modalInput} value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div>
                <label style={{fontSize: '12px', color: '#aaa'}}>Company Name</label>
                <input type="text" style={styles.modalInput} value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})} />
              </div>
              <div>
                <label style={{fontSize: '12px', color: '#aaa'}}>Role/Designation</label>
                <input type="text" style={styles.modalInput} value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} />
              </div>
              <div>
                <label style={{fontSize: '12px', color: '#aaa'}}>Company Website</label>
                <input type="text" style={styles.modalInput} value={formData.company_website} onChange={(e) => setFormData({...formData, company_website: e.target.value})} />
              </div>
              <div>
                <label style={{fontSize: '12px', color: '#aaa'}}>Location</label>
                <input type="text" style={styles.modalInput} value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
              </div>
              <div>
                <label style={{fontSize: '12px', color: '#aaa'}}>Number of Employees</label>
                <input type="text" style={styles.modalInput} value={formData.num_employees} onChange={(e) => setFormData({...formData, num_employees: e.target.value})} />
              </div>
              <div>
                <label style={{fontSize: '12px', color: '#aaa'}}>Budget Range</label>
                <input type="text" style={styles.modalInput} value={formData.budget_range} onChange={(e) => setFormData({...formData, budget_range: e.target.value})} />
              </div>
            </div>

            <div style={{marginTop: '10px'}}>
              <label style={{fontSize: '12px', color: '#aaa'}}>Industry Type</label>
              <select style={styles.modalInput} value={formData.industry_type} onChange={(e) => setFormData({...formData, industry_type: e.target.value})}>
                <option value="">Select...</option>
                <option value="AI Agent Development">AI Agent Development</option>
                <option value="AI Automation for Marketing and Sales">AI Automation for Marketing and Sales</option>
                <option value="SaaS Product Development">SaaS Product Development</option>
                <option value="Website / Application Development">Website / Application Development</option>
                <option value="CRM / ERP / LMS Development">CRM / ERP / LMS Development</option>
                <option value="Digital Optimization & Branding">Digital Optimization & Branding</option>
                <option value="Cloud Infrastructure & Maintenance">Cloud Infrastructure & Maintenance</option>
              </select>
            </div>

            <div style={{marginTop: '10px'}}>
              <label style={{fontSize: '12px', color: '#aaa'}}>Service Requirement</label>
              <select style={styles.modalInput} value={formData.service_requirement} onChange={(e) => setFormData({...formData, service_requirement: e.target.value})}>
                <option value="">Select...</option>
                <option value="AI Agent Development">AI Agent Development</option>
                <option value="AI Automation for Marketing and Sales">AI Automation for Marketing and Sales</option>
                <option value="SaaS Product Development">SaaS Product Development</option>
                <option value="Website / Application Development">Website / Application Development</option>
                <option value="CRM / ERP / LMS Development">CRM / ERP / LMS Development</option>
                <option value="Digital Optimization & Branding">Digital Optimization & Branding</option>
                <option value="Cloud Infrastructure & Maintenance">Cloud Infrastructure & Maintenance</option>
              </select>
            </div>

            <div style={{marginTop: '10px'}}>
              <label style={{fontSize: '12px', color: '#aaa'}}>Expected Timeline</label>
              <select style={styles.modalInput} value={formData.expected_timeline} onChange={(e) => setFormData({...formData, expected_timeline: e.target.value})}>
                <option value="">Select...</option>
                <option value="Immediately">Immediately</option>
                <option value="Within 1 Month">Within 1 Month</option>
                <option value="Within 3 Months">Within 3 Months</option>
                <option value="Planning Stage">Planning Stage</option>
              </select>
            </div>
            
            <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
              <button onClick={() => setShowPreChatForm(false)} style={{flex: 1, padding: '10px', background: '#444', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer'}} disabled={loading}>
                Cancel
              </button>
              <button onClick={handlePreChatSubmit} style={{flex: 1, padding: '10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer'}} disabled={loading}>
                {loading ? "Starting..." : "Start Chat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  floatingBtn: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '30px',
    padding: '12px 20px',
    fontSize: '16px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 9999
  },
  chatWindow: {
    position: 'fixed',
    bottom: '80px',
    right: '20px',
    width: '350px',
    height: '500px',
    backgroundColor: '#1e1e1e',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    zIndex: 9999,
    overflow: 'hidden',
    border: '1px solid #333'
  },
  chatHeader: {
    padding: '15px',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #333'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 5px'
  },
  messageList: {
    flex: 1,
    padding: '15px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  messageBubble: {
    maxWidth: '85%',
    padding: '10px 14px',
    borderRadius: '16px',
    fontSize: '14px',
    lineHeight: '1.4',
    wordWrap: 'break-word'
  },
  inputArea: {
    padding: '15px',
    backgroundColor: '#2a2a2a',
    display: 'flex',
    gap: '10px',
    borderTop: '1px solid #333'
  },
  input: {
    flex: 1,
    padding: '10px 15px',
    borderRadius: '20px',
    border: '1px solid #444',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    outline: 'none',
    fontSize: '14px'
  },
  sendBtn: {
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '20px',
    padding: '0 15px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000
  },
  modalContent: {
    backgroundColor: '#1e1e1e',
    padding: '20px',
    borderRadius: '12px',
    width: '300px',
    color: '#fff',
    border: '1px solid #333'
  },
  modalInput: {
    width: '100%',
    padding: '10px',
    marginBottom: '10px',
    borderRadius: '6px',
    border: '1px solid #444',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    boxSizing: 'border-box'
  }
};

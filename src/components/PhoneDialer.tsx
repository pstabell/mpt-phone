'use client';

import { useState, useEffect, useRef } from 'react';
import { Device } from '@twilio/voice-sdk';

interface CallLog {
  id: string;
  direction: 'outbound' | 'inbound';
  from_number: string;
  to_number: string;
  duration?: number;
  status: 'ringing' | 'connected' | 'completed' | 'failed';
  created_at: string;
  contact_name?: string;
  recording_url?: string;
  recording_duration?: number;
  recording_consent?: boolean;
  voicemail_url?: string;
  voicemail_duration?: number;
  voicemail_transcription?: string;
  call_notes?: string;
  disposition?: string;
  is_voicemail?: boolean;
}

interface Voicemail {
  id: string;
  from_number: string;
  recording_url: string;
  duration?: number;
  transcription?: string;
  is_read: boolean;
  created_at: string;
  contact_name?: string;
}

interface CallRecording {
  id: string;
  call_log_id: string;
  recording_url: string;
  duration?: number;
  consent_given: boolean;
  created_at: string;
}

// Phase 3: CRM and SMS interfaces
interface ContactInfo {
  name: string;
  company?: string;
  notes?: string;
}

interface SmsMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  body: string;
  status: string;
  contact_id?: string;
  created_at: string;
  contact_info?: ContactInfo;
}

// Phase 4: Advanced call features interfaces
interface CallForwardingRule {
  id: string;
  rule_name: string;
  forward_to_number: string;
  condition_type: 'no_answer' | 'busy' | 'always' | 'after_rings';
  ring_count?: number;
  is_active: boolean;
}

interface Favorite {
  id: string;
  contact_name: string;
  phone_number: string;
  company?: string;
  speed_dial_position?: number;
}

interface ConferenceCall {
  id: string;
  conference_name: string;
  conference_sid: string;
  participants: ConferenceParticipant[];
  status: 'active' | 'completed';
}

interface ConferenceParticipant {
  id: string;
  participant_number: string;
  participant_name?: string;
  status: 'connected' | 'disconnected';
  joined_at: string;
}

export default function PhoneDialer() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callStatus, setCallStatus] = useState<string>('');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [availableInputDevices, setAvailableInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [availableOutputDevices, setAvailableOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputDevice, setSelectedInputDevice] = useState<string>('');
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>('');
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'fair' | 'poor' | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<{
    jitter?: number;
    rtt?: number;
    packetLoss?: number;
  }>({});
  const [missedCallsCount, setMissedCallsCount] = useState(0);
  
  // Phase 2: Voicemail & Recording features
  const [voicemails, setVoicemails] = useState<Voicemail[]>([]);
  const [unreadVoicemailCount, setUnreadVoicemailCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingConsentGiven, setRecordingConsentGiven] = useState(false);
  const [showRecordingConsent, setShowRecordingConsent] = useState(false);
  const [currentRecordingSid, setCurrentRecordingSid] = useState<string | null>(null);
  const [showCallNotes, setShowCallNotes] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [callDisposition, setCallDisposition] = useState('');
  const [showVoicemails, setShowVoicemails] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  // Phase 3: CRM and SMS features
  const [currentContactInfo, setCurrentContactInfo] = useState<ContactInfo | null>(null);
  const [smsMessages, setSmsMessages] = useState<SmsMessage[]>([]);
  const [showSmsView, setShowSmsView] = useState(false);
  const [smsInput, setSmsInput] = useState('');
  const [smsRecipient, setSmsRecipient] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [unreadSmsCount, setUnreadSmsCount] = useState(0);

  // Phase 4: Advanced call features
  const [doNotDisturb, setDoNotDisturb] = useState(false);
  const [callForwardingRules, setCallForwardingRules] = useState<CallForwardingRule[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [currentConference, setCurrentConference] = useState<ConferenceCall | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showForwardingSettings, setShowForwardingSettings] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showConferenceControls, setShowConferenceControls] = useState(false);
  const [newParticipantNumber, setNewParticipantNumber] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const [showAddFavorite, setShowAddFavorite] = useState(false);
  const [newFavorite, setNewFavorite] = useState({
    name: '',
    phone: '',
    company: '',
    speedDialPosition: ''
  });

  // Phase 5: Contact name search
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactSearchResults, setContactSearchResults] = useState<Array<{
    id: string;
    name: string;
    company?: string;
    phone: string;
    email?: string;
  }>>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [showContactSearch, setShowContactSearch] = useState(false);
  const contactSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if mobile - require user tap to connect (browser security)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (!isMobile) {
      // Desktop: auto-connect
      initializeTwilioDevice();
    } else {
      // Mobile: show tap to connect message
      setCallStatus('Tap "Connect" to enable calling');
    }
    
    loadCallLogs();
    loadVoicemails();
    
    // Phase 3: Load SMS messages
    loadSmsMessages();
    
    // Phase 3: Handle click-to-call from URL parameters
    handleUrlParameters();
    
    // Phase 3: Setup postMessage API for embedded use
    setupPostMessageAPI();
    
    // Phase 4: Load advanced features
    loadUserSettings();
    loadCallForwardingRules();
    loadFavorites();
    
    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const initializeTwilioDevice = async () => {
    try {
      setIsLoading(true);
      setCallStatus('Requesting microphone access...');
      
      // Request microphone permission first (required for WebRTC)
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone access granted');
      } catch (micError) {
        console.error('Microphone access denied:', micError);
        setCallStatus('Microphone access denied - please allow microphone');
        setIsLoading(false);
        return;
      }
      
      setCallStatus('Getting access token...');
      
      // Get access token from our API
      const response = await fetch('/api/twilio/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: 'mpt-phone-user' }),
      });

      if (!response.ok) {
        throw new Error('Failed to get access token');
      }

      const { token } = await response.json();
      console.log('Token received, initializing device...');
      setCallStatus('Initializing phone...');

      // Initialize Twilio Device (SDK 2.x)
      const device = new Device(token, {
        logLevel: 'debug', // Enable debug logging
        edge: 'ashburn', // Use Ashburn edge for better latency
        enableImprovedSignalingErrorPrecision: true,
      });

      // SDK 2.x uses 'registered' instead of 'ready'
      device.on('registered', () => {
        console.log('Twilio Device is registered and ready');
        setIsConnected(true);
        setIsLoading(false);
        setCallStatus('');
        // Load available audio devices
        loadAvailableDevices();
      });

      device.on('error', (error: any) => {
        console.error('Twilio Device error:', error);
        setCallStatus('Device error: ' + (error.message || error.code || 'Unknown error'));
        setIsLoading(false);
      });

      device.on('unregistered', () => {
        console.log('Twilio Device unregistered');
        setIsConnected(false);
      });

      device.on('incoming', (call: any) => {
        console.log('Incoming call received');
        // For now, we'll reject incoming calls as we're focusing on outbound
        call.reject();
      });

      deviceRef.current = device;
      
      // SDK 2.x requires explicit registration
      console.log('Calling device.register()...');
      setCallStatus('Registering with Twilio...');
      await device.register();

    } catch (error) {
      console.error('Failed to initialize Twilio Device:', error);
      setCallStatus('Failed to initialize phone');
      setIsLoading(false);
    }
  };

  const makeCall = async () => {
    if (!deviceRef.current || !phoneNumber.trim()) return;

    try {
      setIsLoading(true);
      setCallStatus('Looking up contact...');

      // Format phone number (ensure E.164 format)
      let formattedNumber = phoneNumber.replace(/[^0-9+]/g, '');
      if (!formattedNumber.startsWith('+')) {
        if (formattedNumber.length === 10) {
          formattedNumber = '+1' + formattedNumber;
        } else if (formattedNumber.length === 11 && formattedNumber.startsWith('1')) {
          formattedNumber = '+' + formattedNumber;
        }
      }

      // Phase 3: Lookup contact information
      await lookupContactInfo(formattedNumber);

      setCallStatus('Connecting...');
      const call = await deviceRef.current.connect({
        params: {
          To: formattedNumber,
          From: '+12394267058' // JackBot's number as caller ID
        }
      });

      callRef.current = call;
      setIsInCall(true);
      setCallStatus('Ringing...');

      // Log the call start
      await logCall('+12394267058', formattedNumber, 'ringing');

      call.on('accept', () => {
        setCallStatus('Connected');
        setIsLoading(false);
        startCallTimer();
        // Update call log to connected
        updateCallStatus('connected');
        // Setup connection quality monitoring
        setupQualityMonitoring(call);
      });

      call.on('disconnect', () => {
        setIsInCall(false);
        setCallStatus('Call ended');
        setCallDuration(0);
        setIsMuted(false);
        setIsOnHold(false);
        setIsSpeakerOn(false);
        setIsRecording(false);
        setRecordingConsentGiven(false);
        setCurrentRecordingSid(null);
        setCurrentContactInfo(null); // Phase 3: Clear contact info
        callRef.current = null;
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        // Update call log to completed
        updateCallStatus('completed');
        // Show call notes dialog after a brief delay
        setTimeout(() => {
          setCallStatus('');
          showCallNotesDialog();
        }, 2000);
      });

      call.on('reject', () => {
        setIsInCall(false);
        setCallStatus('Call rejected');
        setIsLoading(false);
        setIsMuted(false);
        setIsOnHold(false);
        setIsSpeakerOn(false);
        callRef.current = null;
        // Update call log to failed
        updateCallStatus('failed');
        setTimeout(() => setCallStatus(''), 3000);
      });

    } catch (error) {
      console.error('Failed to make call:', error);
      setCallStatus('Failed to connect');
      setIsLoading(false);
      setIsInCall(false);
      setTimeout(() => setCallStatus(''), 3000);
    }
  };

  const hangupCall = () => {
    if (callRef.current) {
      callRef.current.disconnect();
    }
  };

  const toggleMute = () => {
    if (callRef.current) {
      callRef.current.mute(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleHold = () => {
    if (callRef.current) {
      // In Twilio Voice SDK 2.x, use call.hold() and call.unhold()
      if (isOnHold) {
        callRef.current.unhold();
        setIsOnHold(false);
      } else {
        callRef.current.hold();
        setIsOnHold(true);
      }
    }
  };

  const toggleSpeaker = async () => {
    if (deviceRef.current?.audio) {
      try {
        // @ts-ignore - Twilio SDK types may be outdated
        const audioDevices = deviceRef.current.audio.availableOutputDevices;
        // @ts-ignore
        const currentDevices = deviceRef.current.audio.speakerDevices;
        
        if (isSpeakerOn) {
          // Switch back to default - just toggle state for now
          setIsSpeakerOn(false);
        } else {
          // Switch to speaker - just toggle state for now
          setIsSpeakerOn(true);
        }
      } catch (error) {
        console.error('Failed to toggle speaker:', error);
      }
    }
  };

  const loadAvailableDevices = async () => {
    if (deviceRef.current?.audio) {
      try {
        // Get audio devices from Twilio Device
        // @ts-ignore - Twilio SDK types may vary
        const inputDevices = Array.from(deviceRef.current.audio.availableInputDevices?.values?.() || []);
        // @ts-ignore
        const outputDevices = Array.from(deviceRef.current.audio.availableOutputDevices?.values?.() || []);
        
        setAvailableInputDevices(inputDevices as MediaDeviceInfo[]);
        setAvailableOutputDevices(outputDevices as MediaDeviceInfo[]);
        
        // Set current selected devices
        // @ts-ignore
        const currentInput = Array.from(deviceRef.current.audio.ringtoneDevices?.values?.() || []);
        // @ts-ignore
        const currentOutput = Array.from(deviceRef.current.audio.speakerDevices?.values?.() || []);
        
        if (currentInput.length > 0) {
          setSelectedInputDevice(String(currentInput[0]));
        }
        if (currentOutput.length > 0) {
          setSelectedOutputDevice(String(currentOutput[0]));
        }
        
      } catch (error) {
        console.error('Failed to load audio devices:', error);
      }
    }
  };

  const setInputDevice = async (deviceId: string) => {
    if (deviceRef.current?.audio && deviceId) {
      try {
        await deviceRef.current.audio.ringtoneDevices.set([deviceId]);
        setSelectedInputDevice(deviceId);
      } catch (error) {
        console.error('Failed to set input device:', error);
      }
    }
  };

  const setOutputDevice = async (deviceId: string) => {
    if (deviceRef.current?.audio && deviceId) {
      try {
        await deviceRef.current.audio.speakerDevices.set([deviceId]);
        setSelectedOutputDevice(deviceId);
      } catch (error) {
        console.error('Failed to set output device:', error);
      }
    }
  };

  const setupQualityMonitoring = (call: any) => {
    if (call && call.getRemoteStream) {
      try {
        // Monitor RTCStats for connection quality
        const interval = setInterval(async () => {
          if (call.status() === 'open') {
            try {
              const stats = await call.getRTCRemoteAudioTrackStats();
              if (stats && stats.length > 0) {
                const audioStats = stats[0];
                
                // Extract quality metrics
                const jitter = audioStats.jitter || 0;
                const rtt = audioStats.rtt || 0;
                const packetLoss = audioStats.packetsLost || 0;
                
                setQualityMetrics({ jitter, rtt, packetLoss });
                
                // Determine quality level based on metrics
                let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
                
                if (rtt > 300 || jitter > 50 || packetLoss > 5) {
                  quality = 'poor';
                } else if (rtt > 200 || jitter > 30 || packetLoss > 3) {
                  quality = 'fair';
                } else if (rtt > 100 || jitter > 20 || packetLoss > 1) {
                  quality = 'good';
                }
                
                setConnectionQuality(quality);
              }
            } catch (error) {
              console.warn('Failed to get RTC stats:', error);
            }
          }
        }, 2000); // Check every 2 seconds
        
        // Clear interval when call ends
        call.on('disconnect', () => {
          clearInterval(interval);
          setConnectionQuality(null);
          setQualityMetrics({});
        });
        
      } catch (error) {
        console.error('Failed to setup quality monitoring:', error);
      }
    }
  };

  const startCallTimer = () => {
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const dialpadPress = (digit: string) => {
    setPhoneNumber(prev => prev + digit);
    
    // Send DTMF tone if in call
    if (callRef.current && isInCall) {
      callRef.current.sendDigits(digit);
    }
  };

  const clearNumber = () => {
    setPhoneNumber('');
  };

  const backspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const logCall = async (from: string, to: string, status: string) => {
    try {
      const response = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: 'outbound',
          from_number: from,
          to_number: to,
          status: status,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setCurrentCallId(result.data.id);
        loadCallLogs(); // Refresh call logs
      }
    } catch (error) {
      console.error('Failed to log call:', error);
    }
  };

  const updateCallStatus = async (status: string) => {
    if (!currentCallId) return;
    
    try {
      const response = await fetch(`/api/calls/${currentCallId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: status,
          duration: callDuration,
        }),
      });

      if (response.ok) {
        loadCallLogs(); // Refresh call logs
      }
    } catch (error) {
      console.error('Failed to update call status:', error);
    }
  };

  const loadCallLogs = async () => {
    try {
      const response = await fetch('/api/calls?limit=10');
      if (response.ok) {
        const result = await response.json();
        const logs = result.data || [];
        setCallLogs(logs);
        
        // Count missed calls (inbound calls that were not answered)
        const missedCalls = logs.filter((call: CallLog) => 
          call.direction === 'inbound' && 
          (call.status === 'failed' || (call.status === 'completed' && (!call.duration || call.duration === 0)))
        );
        setMissedCallsCount(missedCalls.length);
      }
    } catch (error) {
      console.error('Failed to load call logs:', error);
    }
  };

  const markMissedCallsAsViewed = () => {
    setMissedCallsCount(0);
    // In a real implementation, you might want to update a 'viewed' flag in the database
  };

  // Phase 2: Load voicemails
  const loadVoicemails = async () => {
    try {
      const response = await fetch('/api/voicemails?limit=20');
      if (response.ok) {
        const result = await response.json();
        const voicemails = result.data || [];
        setVoicemails(voicemails);
        
        // Count unread voicemails
        const unreadCount = voicemails.filter((vm: Voicemail) => !vm.is_read).length;
        setUnreadVoicemailCount(unreadCount);
      }
    } catch (error) {
      console.error('Failed to load voicemails:', error);
    }
  };

  // Phase 2: Start call recording with consent
  const startRecording = async () => {
    if (!callRef.current) return;

    try {
      // Show consent dialog first
      setShowRecordingConsent(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  // Phase 2: Handle recording consent
  const handleRecordingConsent = async (granted: boolean) => {
    setShowRecordingConsent(false);
    
    if (!granted || !callRef.current) return;

    try {
      setRecordingConsentGiven(true);
      
      // Get the Twilio call SID - this would need to be exposed by the SDK
      // For now, we'll simulate this
      const callSid = 'simulated-call-sid';
      
      const response = await fetch('/api/recordings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callSid: callSid,
          consentGiven: true
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setIsRecording(true);
        setCurrentRecordingSid(result.recordingSid);
        console.log('Recording started');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      setRecordingConsentGiven(false);
    }
  };

  // Phase 2: Stop call recording
  const stopRecording = async () => {
    if (!currentRecordingSid) return;

    try {
      // Stop recording via Twilio API (would need backend endpoint)
      setIsRecording(false);
      setCurrentRecordingSid(null);
      console.log('Recording stopped');
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  // Phase 2: Show call notes dialog after call ends
  const showCallNotesDialog = () => {
    setShowCallNotes(true);
  };

  // Phase 2: Save call notes and disposition
  const saveCallNotes = async () => {
    if (!currentCallId) return;

    try {
      const response = await fetch(`/api/calls/${currentCallId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_notes: callNotes,
          disposition: callDisposition,
        }),
      });

      if (response.ok) {
        setShowCallNotes(false);
        setCallNotes('');
        setCallDisposition('');
        loadCallLogs(); // Refresh call logs
      }
    } catch (error) {
      console.error('Failed to save call notes:', error);
    }
  };

  // Phase 2: Mark voicemail as read
  const markVoicemailAsRead = async (voicemailId: string) => {
    try {
      const response = await fetch(`/api/voicemails/${voicemailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      });

      if (response.ok) {
        loadVoicemails(); // Refresh voicemails
      }
    } catch (error) {
      console.error('Failed to mark voicemail as read:', error);
    }
  };

  // Phase 2: Delete voicemail
  const deleteVoicemail = async (voicemailId: string) => {
    try {
      const response = await fetch(`/api/voicemails/${voicemailId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadVoicemails(); // Refresh voicemails
      }
    } catch (error) {
      console.error('Failed to delete voicemail:', error);
    }
  };

  // Phase 2: Play/pause audio
  const toggleAudioPlayback = (url: string) => {
    if (playingAudio === url) {
      setPlayingAudio(null);
    } else {
      setPlayingAudio(url);
    }
  };

  // Phase 2: Format duration for display
  const formatVoicemailDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Phase 3: CRM and SMS Functions
  
  // Handle URL parameters for click-to-call
  const handleUrlParameters = () => {
    if (typeof window === 'undefined') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const callNumber = urlParams.get('call');
    
    if (callNumber) {
      setPhoneNumber(callNumber);
      // Auto-dial if device is ready
      setTimeout(() => {
        if (isConnected && !isInCall) {
          makeCall();
        }
      }, 1000);
    }
  };

  // Setup postMessage API for embedded use
  const setupPostMessageAPI = () => {
    if (typeof window === 'undefined') return;
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'MPT_PHONE_CALL') {
        const { phoneNumber: number } = event.data;
        if (number) {
          setPhoneNumber(number);
          // Auto-dial if device is ready
          if (isConnected && !isInCall) {
            makeCall();
          }
        }
      } else if (event.data && event.data.type === 'MPT_PHONE_SMS') {
        const { phoneNumber: number, message } = event.data;
        if (number) {
          setSmsRecipient(number);
          if (message) {
            setSmsInput(message);
          }
          setShowSmsView(true);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Notify parent that we're ready for postMessages
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'MPT_PHONE_READY' }, '*');
    }
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  };

  // Load SMS messages
  const loadSmsMessages = async () => {
    try {
      const response = await fetch('/api/sms?limit=50');
      if (response.ok) {
        const result = await response.json();
        const messages = result.data || [];
        setSmsMessages(messages);
        
        // Count unread SMS messages (inbound messages that haven't been viewed)
        const unreadCount = messages.filter((msg: SmsMessage) => 
          msg.direction === 'inbound' && 
          new Date(msg.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        ).length;
        setUnreadSmsCount(unreadCount);
      }
    } catch (error) {
      console.error('Failed to load SMS messages:', error);
    }
  };

  // Send SMS message
  const sendSmsMessage = async () => {
    if (!smsRecipient.trim() || !smsInput.trim()) return;
    
    try {
      setIsSendingSms(true);
      
      const response = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: smsRecipient,
          body: smsInput,
        }),
      });

      if (response.ok) {
        setSmsInput('');
        loadSmsMessages(); // Refresh messages
      } else {
        const error = await response.json();
        console.error('Failed to send SMS:', error);
        alert('Failed to send SMS: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      alert('Error sending SMS');
    } finally {
      setIsSendingSms(false);
    }
  };

  // Lookup contact information
  const lookupContactInfo = async (phoneNumber: string) => {
    try {
      const response = await fetch(`/api/contacts/lookup?phone=${encodeURIComponent(phoneNumber)}`);
      if (response.ok) {
        const result = await response.json();
        if (result.found && result.contact) {
          const contactInfo: ContactInfo = {
            name: result.displayName,
            company: result.contact.company,
            notes: result.contact.notes
          };
          setCurrentContactInfo(contactInfo);
          return contactInfo;
        }
      }
    } catch (error) {
      console.error('Error looking up contact:', error);
    }
    return null;
  };

  // Clear unread SMS count
  const clearUnreadSmsCount = () => {
    setUnreadSmsCount(0);
  };

  // Phase 5: Search contacts by name
  const searchContactsByName = async (query: string) => {
    if (!query || query.length < 2) {
      setContactSearchResults([]);
      return;
    }

    setIsSearchingContacts(true);
    try {
      const response = await fetch(`/api/contacts/search?q=${encodeURIComponent(query)}&limit=8`);
      if (response.ok) {
        const result = await response.json();
        setContactSearchResults(result.contacts || []);
      } else {
        setContactSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching contacts:', error);
      setContactSearchResults([]);
    } finally {
      setIsSearchingContacts(false);
    }
  };

  // Debounced contact search
  const handleContactSearchChange = (query: string) => {
    setContactSearchQuery(query);
    setShowContactSearch(true);
    
    // Clear previous timeout
    if (contactSearchTimeoutRef.current) {
      clearTimeout(contactSearchTimeoutRef.current);
    }
    
    // Debounce search
    contactSearchTimeoutRef.current = setTimeout(() => {
      searchContactsByName(query);
    }, 300);
  };

  // Select contact from search results
  const selectContact = (contact: { name: string; phone: string }) => {
    setPhoneNumber(contact.phone);
    setContactSearchQuery('');
    setContactSearchResults([]);
    setShowContactSearch(false);
  };

  // Phase 4: Advanced Call Features Functions

  // Load user settings (DND, etc.)
  const loadUserSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const result = await response.json();
        const settings = result.data || [];
        
        const dndSetting = settings.find((s: any) => s.setting_key === 'do_not_disturb');
        if (dndSetting) {
          setDoNotDisturb(dndSetting.setting_value === 'true');
        }
      }
    } catch (error) {
      console.error('Failed to load user settings:', error);
    }
  };

  // Load call forwarding rules
  const loadCallForwardingRules = async () => {
    try {
      const response = await fetch('/api/call-forwarding');
      if (response.ok) {
        const result = await response.json();
        setCallForwardingRules(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load call forwarding rules:', error);
    }
  };

  // Load favorites
  const loadFavorites = async () => {
    try {
      const response = await fetch('/api/favorites');
      if (response.ok) {
        const result = await response.json();
        setFavorites(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  };

  // Toggle Do Not Disturb mode
  const toggleDoNotDisturb = async () => {
    const newValue = !doNotDisturb;
    setDoNotDisturb(newValue);
    
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting_key: 'do_not_disturb',
          setting_value: newValue.toString()
        }),
      });
    } catch (error) {
      console.error('Failed to update DND setting:', error);
      // Revert on error
      setDoNotDisturb(!newValue);
    }
  };

  // Transfer call to Jack (warm handoff)
  const transferToJack = async () => {
    if (!callRef.current) return;
    
    try {
      setIsTransferring(true);
      setCallStatus('Transferring to Jack...');
      
      // Use Twilio's warm transfer capability
      const response = await fetch('/api/calls/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callSid: callRef.current.parameters.CallSid, // This would need to be exposed by SDK
          transferTo: '+12399661917', // Jack's Vapi number
          transferType: 'warm'
        }),
      });

      if (response.ok) {
        setCallStatus('Call transferred to Jack');
        // The call will disconnect from our end after transfer
        setTimeout(() => {
          if (callRef.current) {
            callRef.current.disconnect();
          }
        }, 2000);
      } else {
        throw new Error('Transfer failed');
      }
    } catch (error) {
      console.error('Failed to transfer call:', error);
      setCallStatus('Transfer failed');
      setTimeout(() => setCallStatus('Connected'), 3000);
    } finally {
      setIsTransferring(false);
    }
  };

  // Start conference call
  const startConference = async () => {
    if (!callRef.current) return;
    
    try {
      const conferenceName = `conf-${Date.now()}`;
      
      const response = await fetch('/api/conference/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conferenceName,
          currentCallSid: callRef.current.parameters.CallSid
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setCurrentConference({
          id: result.conferenceId,
          conference_name: conferenceName,
          conference_sid: result.conferenceSid,
          participants: result.participants || [],
          status: 'active'
        });
        setShowConferenceControls(true);
        setCallStatus('Conference started');
      }
    } catch (error) {
      console.error('Failed to start conference:', error);
    }
  };

  // Add participant to conference
  const addParticipantToConference = async () => {
    if (!currentConference || !newParticipantNumber.trim()) return;
    
    try {
      setIsAddingParticipant(true);
      
      const response = await fetch('/api/conference/add-participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conferenceSid: currentConference.conference_sid,
          participantNumber: newParticipantNumber
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Refresh conference data
        await loadConferenceData(currentConference.id);
        setNewParticipantNumber('');
      }
    } catch (error) {
      console.error('Failed to add participant:', error);
    } finally {
      setIsAddingParticipant(false);
    }
  };

  // Load conference data
  const loadConferenceData = async (conferenceId: string) => {
    try {
      const response = await fetch(`/api/conference/${conferenceId}`);
      if (response.ok) {
        const result = await response.json();
        setCurrentConference(result.data);
      }
    } catch (error) {
      console.error('Failed to load conference data:', error);
    }
  };

  // Add to favorites
  const addToFavorites = async () => {
    if (!newFavorite.name.trim() || !newFavorite.phone.trim()) return;
    
    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: newFavorite.name,
          phone_number: newFavorite.phone,
          company: newFavorite.company,
          speed_dial_position: newFavorite.speedDialPosition ? parseInt(newFavorite.speedDialPosition) : null
        }),
      });

      if (response.ok) {
        await loadFavorites();
        setShowAddFavorite(false);
        setNewFavorite({ name: '', phone: '', company: '', speedDialPosition: '' });
      }
    } catch (error) {
      console.error('Failed to add favorite:', error);
    }
  };

  // Remove from favorites
  const removeFromFavorites = async (favoriteId: string) => {
    try {
      const response = await fetch(`/api/favorites/${favoriteId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadFavorites();
      }
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  };

  // Call favorite
  const callFavorite = async (phoneNumber: string) => {
    setPhoneNumber(phoneNumber);
    if (isConnected && !isInCall) {
      await makeCall();
    }
  };

  // Save call forwarding rule
  const saveForwardingRule = async (rule: Partial<CallForwardingRule>) => {
    try {
      const response = await fetch('/api/call-forwarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });

      if (response.ok) {
        await loadCallForwardingRules();
      }
    } catch (error) {
      console.error('Failed to save forwarding rule:', error);
    }
  };

  // Delete call forwarding rule
  const deleteForwardingRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/call-forwarding/${ruleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadCallForwardingRules();
      }
    } catch (error) {
      console.error('Failed to delete forwarding rule:', error);
    }
  };

  // Toggle forwarding rule active status
  const toggleForwardingRule = async (ruleId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/call-forwarding/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      });

      if (response.ok) {
        await loadCallForwardingRules();
      }
    } catch (error) {
      console.error('Failed to toggle forwarding rule:', error);
    }
  };

  // Dialpad buttons
  const dialpadButtons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ];

  // Phase 2: Disposition options
  const dispositionOptions = [
    { value: 'completed', label: 'Completed' },
    { value: 'follow_up_needed', label: 'Follow-up Needed' },
    { value: 'wrong_number', label: 'Wrong Number' },
    { value: 'no_answer', label: 'No Answer' },
    { value: 'busy', label: 'Busy' },
    { value: 'interested', label: 'Interested' },
    { value: 'not_interested', label: 'Not Interested' },
    { value: 'callback_requested', label: 'Callback Requested' }
  ];

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 space-y-6">
      {/* Connection Status & Missed Calls */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            isConnected ? 'bg-green-100 text-green-800' : isLoading ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              isConnected ? 'bg-green-400' : isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
            }`}></div>
            {isLoading ? 'Connecting...' : isConnected ? 'Ready' : 'Not Connected'}
          </div>
          {!isConnected && !isLoading && (
            <button
              onClick={initializeTwilioDevice}
              className="px-4 py-2 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: '#00919E', minHeight: '44px' }}
            >
              📞 Connect
            </button>
          )}
        </div>
        {callStatus && (
          <p className="text-xs text-gray-500">{callStatus}</p>
        )}
        
        {/* Missed Call Notification */}
        {missedCallsCount > 0 && (
          <div 
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 cursor-pointer hover:bg-red-200 transition-colors"
            onClick={markMissedCallsAsViewed}
            title="Click to clear missed call notifications"
          >
            <div className="w-2 h-2 rounded-full mr-2 bg-red-500 animate-pulse"></div>
            {missedCallsCount} Missed Call{missedCallsCount > 1 ? 's' : ''}
          </div>
        )}
        
        {/* Phase 2: Voicemail Notification */}
        {unreadVoicemailCount > 0 && (
          <div 
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200 transition-colors"
            onClick={() => setShowVoicemails(true)}
            title="Click to view voicemails"
          >
            <div className="w-2 h-2 rounded-full mr-2 bg-blue-500 animate-pulse"></div>
            {unreadVoicemailCount} New Voicemail{unreadVoicemailCount > 1 ? 's' : ''}
          </div>
        )}

        {/* Phase 3: SMS Notification */}
        {unreadSmsCount > 0 && (
          <div 
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 cursor-pointer hover:bg-green-200 transition-colors"
            onClick={() => {
              setShowSmsView(true);
              clearUnreadSmsCount();
            }}
            title="Click to view SMS messages"
          >
            <div className="w-2 h-2 rounded-full mr-2 bg-green-500 animate-pulse"></div>
            {unreadSmsCount} New SMS{unreadSmsCount > 1 ? '' : ''}
          </div>
        )}
      </div>

      {/* Contact Search */}
      <div className="relative">
        <div className="mb-3">
          <input
            type="text"
            value={contactSearchQuery}
            onChange={(e) => handleContactSearchChange(e.target.value)}
            onFocus={() => setShowContactSearch(true)}
            placeholder="🔍 Search contacts by name..."
            className="w-full p-3 rounded-lg focus:outline-none bg-white text-gray-900"
            style={{ border: '2px solid #00919E' }}
          />
        </div>
        
        {/* Contact Search Results */}
        {showContactSearch && (contactSearchQuery.length >= 2 || contactSearchResults.length > 0) && (
          <div 
            className="absolute z-10 w-full bg-white rounded-lg shadow-lg max-h-60 overflow-y-auto"
            style={{ border: '2px solid #00919E', top: '100%', marginTop: '-8px' }}
          >
            {isSearchingContacts ? (
              <div className="p-4 text-center text-gray-500">
                <span className="animate-spin inline-block mr-2">⏳</span>
                Searching...
              </div>
            ) : contactSearchResults.length > 0 ? (
              <div>
                {contactSearchResults.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => selectContact(contact)}
                    className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="font-medium text-gray-900">{contact.name}</div>
                    {contact.company && (
                      <div className="text-sm text-gray-500">{contact.company}</div>
                    )}
                    <div className="text-sm" style={{ color: '#00919E' }}>{contact.phone}</div>
                  </button>
                ))}
              </div>
            ) : contactSearchQuery.length >= 2 ? (
              <div className="p-4 text-center text-gray-500" style={{ borderTop: '1px solid #e5e7eb' }}>
                No contacts found for "{contactSearchQuery}"
              </div>
            ) : null}
          </div>
        )}
        
      </div>
      
      {/* Click outside to close contact search - positioned below search */}
      {showContactSearch && contactSearchQuery.length >= 2 && (
        <div 
          className="fixed inset-0" 
          style={{ zIndex: -1 }}
          onClick={() => setShowContactSearch(false)}
        />
      )}

      {/* Phone Number Display */}
      <div className="text-center">
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="Enter phone number"
          className="text-2xl font-mono text-center w-full p-4 rounded-lg focus:outline-none bg-white text-gray-900 shadow-inner"
          style={{ border: '3px solid #00919E' }}
        />
        {phoneNumber && (
          <button
            onClick={backspace}
            className="mt-2 text-gray-500 hover:text-gray-700"
          >
            ⌫ Backspace
          </button>
        )}
      </div>

      {/* Call Status */}
      {callStatus && (
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-gray-700">{callStatus}</p>
          
          {/* Phase 3: Contact Information Display */}
          {currentContactInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mx-auto max-w-md">
              <div className="font-semibold text-blue-900">{currentContactInfo.name}</div>
              {currentContactInfo.company && (
                <div className="text-blue-700 text-sm">{currentContactInfo.company}</div>
              )}
              {currentContactInfo.notes && (
                <div className="text-blue-600 text-xs mt-1 italic">"{currentContactInfo.notes}"</div>
              )}
            </div>
          )}
          
          {isInCall && (
            <div className="space-y-1">
              <p className="text-xl font-mono text-blue-600">{formatDuration(callDuration)}</p>
              {/* Connection Quality Indicator */}
              {connectionQuality && (
                <div className="flex items-center justify-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    connectionQuality === 'excellent' ? 'bg-green-500' :
                    connectionQuality === 'good' ? 'bg-yellow-500' :
                    connectionQuality === 'fair' ? 'bg-orange-500' : 'bg-red-500'
                  }`}></div>
                  <span className={`text-sm font-medium ${
                    connectionQuality === 'excellent' ? 'text-green-600' :
                    connectionQuality === 'good' ? 'text-yellow-600' :
                    connectionQuality === 'fair' ? 'text-orange-600' : 'text-red-600'
                  }`}>
                    {connectionQuality.charAt(0).toUpperCase() + connectionQuality.slice(1)} Quality
                  </span>
                  {qualityMetrics.rtt && (
                    <span className="text-xs text-gray-500">
                      ({Math.round(qualityMetrics.rtt)}ms)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Phase 4: Settings and Status Bar */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-3">
          {/* Do Not Disturb Indicator */}
          <button
            onClick={toggleDoNotDisturb}
            className={`flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              doNotDisturb 
                ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="Toggle Do Not Disturb"
          >
            <span className="mr-1">{doNotDisturb ? '🔕' : '🔔'}</span>
            {doNotDisturb ? 'DND On' : 'DND Off'}
          </button>

          {/* Call Forwarding Indicator */}
          {callForwardingRules.some(rule => rule.is_active) && (
            <div className="flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              <span className="mr-1">📞</span>
              Forwarding Active
            </div>
          )}
        </div>

        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(true)}
          className="text-gray-600 hover:text-gray-800 p-3 text-xl rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
          title="Settings"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          ⚙️
        </button>
      </div>

      {/* Favorites Quick Access */}
      {favorites.length > 0 && !isInCall && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Quick Dial</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {favorites.slice(0, 6).map((favorite) => (
              <button
                key={favorite.id}
                onClick={() => callFavorite(favorite.phone_number)}
                className="rounded-lg p-3 text-left transition-colors"
                style={{ 
                  backgroundColor: 'rgba(0, 145, 158, 0.1)', 
                  border: '1px solid rgba(0, 145, 158, 0.3)' 
                }}
                disabled={!isConnected}
              >
                <div className="font-medium text-gray-900 text-sm truncate">
                  {favorite.contact_name}
                </div>
                <div className="text-xs truncate" style={{ color: '#00919E' }}>
                  {favorite.phone_number}
                </div>
                {favorite.company && (
                  <div className="text-gray-500 text-xs truncate">
                    {favorite.company}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Call Controls */}
      <div className="flex justify-center space-x-4">
        {!isInCall ? (
          <button
            onClick={makeCall}
            disabled={!isConnected || !phoneNumber.trim() || isLoading}
            className="disabled:bg-gray-300 text-white px-6 py-3 rounded-full font-semibold flex items-center space-x-2"
            style={{ backgroundColor: '#00919E' }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#007A85'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#00919E'}
          >
            <span>📞</span>
            <span>Call</span>
          </button>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            {/* First row - main controls */}
            <div className="flex space-x-3">
              <button
                onClick={toggleMute}
                className={`px-4 py-2 rounded-full font-medium transition-colors ${
                  isMuted ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? '🔇' : '🎤'}
              </button>
              <button
                onClick={toggleHold}
                className={`px-4 py-2 rounded-full font-medium transition-colors ${
                  isOnHold ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title={isOnHold ? 'Resume' : 'Hold'}
              >
                {isOnHold ? '▶️' : '⏸️'}
              </button>
              <button
                onClick={toggleSpeaker}
                className={`px-4 py-2 rounded-full font-medium transition-colors ${
                  isSpeakerOn ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title={isSpeakerOn ? 'Speaker Off' : 'Speaker On'}
              >
                {isSpeakerOn ? '🔊' : '🔈'}
              </button>
              
              {/* Phase 2: Recording Button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`px-4 py-2 rounded-full font-medium transition-colors ${
                  isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title={isRecording ? 'Stop Recording' : 'Start Recording'}
              >
                {isRecording ? '⏹️' : '🔴'}
              </button>
              
              {/* Phase 4: Transfer to Jack Button */}
              <button
                onClick={transferToJack}
                disabled={isTransferring}
                className="px-4 py-2 rounded-full font-medium bg-purple-200 text-purple-700 hover:bg-purple-300 transition-colors disabled:opacity-50"
                title="Transfer to Jack (AI Assistant)"
              >
                {isTransferring ? '⏳' : '🤖'}
              </button>

              {/* Phase 4: Conference Button */}
              <button
                onClick={currentConference ? () => setShowConferenceControls(true) : startConference}
                className="px-4 py-2 rounded-full font-medium bg-indigo-200 text-indigo-700 hover:bg-indigo-300 transition-colors"
                title={currentConference ? 'Conference Controls' : 'Start Conference'}
              >
                👥
              </button>
              
              <button
                onClick={hangupCall}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full font-semibold transition-colors"
                title="Hang Up"
              >
                📵 End Call
              </button>
            </div>

            {/* Phase 4: Conference Status */}
            {currentConference && (
              <div className="mt-3 text-center">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                  <span className="mr-2">👥</span>
                  Conference: {currentConference.participants?.length || 0} participants
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audio Device Selector */}
      {isConnected && !isInCall && (availableInputDevices.length > 1 || availableOutputDevices.length > 1) && (
        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-700 mb-3 text-center">Audio Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Input Device Selector */}
            {availableInputDevices.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🎤 Microphone
                </label>
                <select
                  value={selectedInputDevice}
                  onChange={(e) => setInputDevice(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white text-gray-900"
                >
                  {availableInputDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Output Device Selector */}
            {availableOutputDevices.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🔊 Speaker
                </label>
                <select
                  value={selectedOutputDevice}
                  onChange={(e) => setOutputDevice(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white text-gray-900"
                >
                  {availableOutputDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialpad */}
      <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
        {dialpadButtons.flat().map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => dialpadPress(digit)}
            className="bg-gray-200 hover:bg-blue-100 active:bg-blue-200 text-gray-900 text-2xl font-bold py-5 rounded-xl transition-all cursor-pointer select-none"
            style={{ border: '2px solid #6b7280', minHeight: '60px' }}
          >
            {digit}
          </button>
        ))}
      </div>

      {/* Clear Button */}
      {phoneNumber && (
        <div className="text-center">
          <button
            onClick={clearNumber}
            className="text-gray-500 hover:text-gray-700 font-medium"
          >
            Clear
          </button>
        </div>
      )}

      {/* Phase 2: Voicemail Button - Always show */}
      {!isInCall && (
        <div className="text-center">
          <button
            onClick={() => setShowVoicemails(true)}
            className="text-white px-4 py-2 rounded-lg font-medium flex items-center mx-auto"
            style={{ backgroundColor: '#00919E' }}
          >
            <span className="mr-2">🎧</span>
            Voicemails {unreadVoicemailCount > 0 && `(${unreadVoicemailCount} new)`}
          </button>
        </div>
      )}

      {/* Phase 3: SMS Button */}
      {!isInCall && (
        <div className="text-center">
          <div className="flex justify-center space-x-3">
            <button
              onClick={() => {
                setSmsRecipient(phoneNumber || '');
                setShowSmsView(true);
                clearUnreadSmsCount();
              }}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium flex items-center"
            >
              <span className="mr-2">💬</span>
              Send SMS
            </button>
            
            {smsMessages.length > 0 && (
              <button
                onClick={() => {
                  setShowSmsView(true);
                  clearUnreadSmsCount();
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium flex items-center"
              >
                <span className="mr-2">📱</span>
                View SMS {unreadSmsCount > 0 && `(${unreadSmsCount} new)`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Call History */}
      {callLogs.length > 0 && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">Recent Calls</h3>
            {missedCallsCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {missedCallsCount} missed
              </span>
            )}
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {callLogs.map((call) => {
              const displayNumber = call.direction === 'outbound' ? call.to_number : call.from_number;
              const callDate = new Date(call.created_at);
              const timeString = callDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateString = callDate.toLocaleDateString() === new Date().toLocaleDateString() 
                ? 'Today' 
                : callDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
              
              // Check if this is a missed call
              const isMissedCall = call.direction === 'inbound' && 
                (call.status === 'failed' || (call.status === 'completed' && (!call.duration || call.duration === 0)));
              
              return (
                <div key={call.id} className={`flex justify-between items-center text-sm p-3 rounded-lg ${
                  isMissedCall ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center space-x-3">
                    {/* Call Direction Icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs ${
                      isMissedCall ? 'bg-red-500' : 
                      call.direction === 'outbound' ? 'bg-blue-500' : 'bg-green-500'
                    }`}>
                      {isMissedCall ? '❌' : call.direction === 'outbound' ? '📞' : '📲'}
                    </div>
                    <div>
                      {/* Contact Name or Phone Number */}
                      <div className="font-medium text-gray-900">
                        {call.contact_name || displayNumber}
                      </div>
                      {call.contact_name && (
                        <div className="text-gray-500 text-xs">{displayNumber}</div>
                      )}
                      {/* Date and Time */}
                      <div className="text-gray-500 text-xs">{dateString} at {timeString}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {/* Call Status */}
                    <div className={`font-medium text-xs px-2 py-1 rounded ${
                      call.status === 'completed' ? 'bg-green-100 text-green-700' : 
                      call.status === 'failed' ? 'bg-red-100 text-red-700' : 
                      call.status === 'ringing' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {call.status}
                    </div>
                    {/* Duration */}
                    {call.duration && call.duration > 0 && (
                      <div className="text-gray-500 text-xs mt-1">{formatDuration(call.duration)}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Phase 2: Recording Consent Dialog */}
      {showRecordingConsent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Record Call</h3>
            <p className="text-gray-600 mb-6">
              This call may be recorded for quality purposes. Do you consent to recording this call?
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => handleRecordingConsent(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRecordingConsent(true)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Start Recording
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2: Call Notes Dialog */}
      {showCallNotes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Call Notes & Disposition</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Call Disposition
                </label>
                <select
                  value={callDisposition}
                  onChange={(e) => setCallDisposition(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select disposition...</option>
                  {dispositionOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Call Notes
                </label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Enter any notes about this call..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  rows={4}
                />
              </div>
            </div>

            <div className="flex space-x-3 justify-end mt-6">
              <button
                onClick={() => setShowCallNotes(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Skip
              </button>
              <button
                onClick={saveCallNotes}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2: Voicemails Modal */}
      {showVoicemails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Voicemails</h3>
              <button
                onClick={() => setShowVoicemails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            {voicemails.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No voicemails found</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {voicemails.map((voicemail) => {
                  const callDate = new Date(voicemail.created_at);
                  const timeString = callDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const dateString = callDate.toLocaleDateString() === new Date().toLocaleDateString() 
                    ? 'Today' 
                    : callDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

                  return (
                    <div key={voicemail.id} className={`p-4 rounded-lg border ${
                      voicemail.is_read ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            {!voicemail.is_read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                            <div className="font-medium text-gray-900">
                              {voicemail.contact_name || voicemail.from_number}
                            </div>
                            {voicemail.contact_name && (
                              <div className="text-gray-500 text-sm">{voicemail.from_number}</div>
                            )}
                          </div>
                          
                          <div className="text-gray-500 text-sm mb-2">
                            {dateString} at {timeString}
                            {voicemail.duration && (
                              <span className="ml-2">• {formatVoicemailDuration(voicemail.duration)}</span>
                            )}
                          </div>

                          {voicemail.transcription && (
                            <div className="text-gray-700 text-sm mb-3 bg-white p-3 rounded border">
                              "{voicemail.transcription}"
                            </div>
                          )}

                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => toggleAudioPlayback(voicemail.recording_url)}
                              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
                            >
                              <span>{playingAudio === voicemail.recording_url ? '⏸️' : '▶️'}</span>
                              <span>Play</span>
                            </button>
                            
                            {!voicemail.is_read && (
                              <button
                                onClick={() => markVoicemailAsRead(voicemail.id)}
                                className="text-gray-600 hover:text-gray-800 text-sm"
                              >
                                Mark as Read
                              </button>
                            )}
                            
                            <button
                              onClick={() => deleteVoicemail(voicemail.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Audio Player */}
                      {playingAudio === voicemail.recording_url && (
                        <div className="mt-3">
                          <audio
                            controls
                            autoPlay
                            className="w-full"
                            src={voicemail.recording_url}
                            onEnded={() => setPlayingAudio(null)}
                          >
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Phase 3: SMS Modal */}
      {showSmsView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">SMS Messages</h3>
              <button
                onClick={() => setShowSmsView(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            {/* SMS Compose */}
            <div className="border-b pb-4 mb-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To:
                  </label>
                  <input
                    type="tel"
                    value={smsRecipient}
                    onChange={(e) => setSmsRecipient(e.target.value)}
                    placeholder="Enter phone number"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message:
                  </label>
                  <textarea
                    value={smsInput}
                    onChange={(e) => setSmsInput(e.target.value)}
                    placeholder="Type your message..."
                    rows={3}
                    maxLength={160}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {smsInput.length}/160 characters
                  </div>
                </div>
                
                <button
                  onClick={sendSmsMessage}
                  disabled={!smsRecipient.trim() || !smsInput.trim() || isSendingSms}
                  className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium flex items-center"
                >
                  {isSendingSms ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">📤</span>
                      Send SMS
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* SMS History */}
            <div className="max-h-[40vh] overflow-y-auto">
              <h4 className="font-medium text-gray-700 mb-3">Recent Messages</h4>
              
              {smsMessages.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No SMS messages found</p>
              ) : (
                <div className="space-y-3">
                  {smsMessages.map((message) => {
                    const isOutbound = message.direction === 'outbound';
                    const messageDate = new Date(message.created_at);
                    const timeString = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const dateString = messageDate.toLocaleDateString() === new Date().toLocaleDateString() 
                      ? 'Today' 
                      : messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

                    return (
                      <div key={message.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          isOutbound 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200 text-gray-900'
                        }`}>
                          <div className="text-sm">
                            {!isOutbound && message.contact_info ? (
                              <div className="font-medium mb-1">
                                {message.contact_info.name}
                                {message.contact_info.company && (
                                  <span className="text-xs opacity-75"> ({message.contact_info.company})</span>
                                )}
                              </div>
                            ) : !isOutbound && (
                              <div className="font-medium mb-1 text-xs">
                                {message.from_number}
                              </div>
                            )}
                            <div>{message.body}</div>
                            <div className={`text-xs mt-1 ${
                              isOutbound ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {dateString} at {timeString}
                              {isOutbound && (
                                <span className="ml-2 capitalize">
                                  {message.status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Phase 4: Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Phone Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Do Not Disturb Setting */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Do Not Disturb</div>
                  <div className="text-sm text-gray-500">Send all calls to voicemail</div>
                </div>
                <button
                  onClick={toggleDoNotDisturb}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    doNotDisturb ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      doNotDisturb ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Call Forwarding */}
              <div>
                <button
                  onClick={() => {
                    setShowSettings(false);
                    setShowForwardingSettings(true);
                  }}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-50"
                >
                  <div className="font-medium">Call Forwarding</div>
                  <div className="text-sm text-gray-500">
                    {callForwardingRules.filter(r => r.is_active).length > 0 
                      ? `${callForwardingRules.filter(r => r.is_active).length} rules active`
                      : 'No active rules'
                    }
                  </div>
                </button>
              </div>

              {/* Favorites Management */}
              <div>
                <button
                  onClick={() => {
                    setShowSettings(false);
                    setShowFavorites(true);
                  }}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-50"
                >
                  <div className="font-medium">Speed Dial & Favorites</div>
                  <div className="text-sm text-gray-500">
                    {favorites.length} favorites saved
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase 4: Call Forwarding Settings Modal */}
      {showForwardingSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Call Forwarding Rules</h3>
              <button
                onClick={() => setShowForwardingSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto">
              {callForwardingRules.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No forwarding rules configured
                </div>
              ) : (
                <div className="space-y-3">
                  {callForwardingRules.map((rule) => (
                    <div key={rule.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{rule.rule_name}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            Forward to: {rule.forward_to_number}
                          </div>
                          <div className="text-sm text-gray-500">
                            When: {rule.condition_type === 'after_rings' 
                              ? `After ${rule.ring_count} rings`
                              : rule.condition_type.replace('_', ' ')
                            }
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleForwardingRule(rule.id, !rule.is_active)}
                            className={`px-3 py-1 rounded text-sm font-medium ${
                              rule.is_active 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </button>
                          <button
                            onClick={() => deleteForwardingRule(rule.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="border-t mt-4 pt-4">
              <button
                onClick={() => {
                  // Add new forwarding rule - would open another modal
                  alert('Add forwarding rule functionality to be implemented');
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
              >
                Add Forwarding Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 4: Favorites Management Modal */}
      {showFavorites && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Speed Dial & Favorites</h3>
              <button
                onClick={() => setShowFavorites(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto mb-4">
              {favorites.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No favorites added yet
                </div>
              ) : (
                <div className="space-y-3">
                  {favorites.map((favorite) => (
                    <div key={favorite.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{favorite.contact_name}</div>
                          <div className="text-sm text-gray-600">{favorite.phone_number}</div>
                          {favorite.company && (
                            <div className="text-sm text-gray-500">{favorite.company}</div>
                          )}
                          {favorite.speed_dial_position && (
                            <div className="text-xs text-blue-600 mt-1">
                              Speed dial: {favorite.speed_dial_position}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => callFavorite(favorite.phone_number)}
                            disabled={!isConnected || isInCall}
                            className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded text-sm font-medium disabled:opacity-50"
                          >
                            Call
                          </button>
                          <button
                            onClick={() => removeFromFavorites(favorite.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="border-t pt-4">
              <button
                onClick={() => setShowAddFavorite(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
              >
                Add Favorite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 4: Add Favorite Modal */}
      {showAddFavorite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add to Favorites</h3>
              <button
                onClick={() => {
                  setShowAddFavorite(false);
                  setNewFavorite({ name: '', phone: '', company: '', speedDialPosition: '' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={newFavorite.name}
                  onChange={(e) => setNewFavorite(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Contact name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={newFavorite.phone}
                  onChange={(e) => setNewFavorite(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={newFavorite.company}
                  onChange={(e) => setNewFavorite(prev => ({ ...prev, company: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Company name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Speed Dial Position (1-9)
                </label>
                <input
                  type="number"
                  min="1"
                  max="9"
                  value={newFavorite.speedDialPosition}
                  onChange={(e) => setNewFavorite(prev => ({ ...prev, speedDialPosition: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Optional"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowAddFavorite(false);
                  setNewFavorite({ name: '', phone: '', company: '', speedDialPosition: '' });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={addToFavorites}
                disabled={!newFavorite.name.trim() || !newFavorite.phone.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                Add Favorite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 4: Conference Controls Modal */}
      {showConferenceControls && currentConference && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Conference Call</h3>
              <button
                onClick={() => setShowConferenceControls(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Current Participants */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2">
                  Participants ({currentConference.participants?.length || 0})
                </h4>
                {currentConference.participants && currentConference.participants.length > 0 ? (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {currentConference.participants.map((participant) => (
                      <div key={participant.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <div className="font-medium text-sm">
                            {participant.participant_name || participant.participant_number}
                          </div>
                          <div className="text-xs text-gray-500">
                            {participant.status}
                          </div>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${
                          participant.status === 'connected' ? 'bg-green-500' : 'bg-gray-400'
                        }`}></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 py-2">No participants yet</div>
                )}
              </div>
              
              {/* Add Participant */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Add Participant</h4>
                <div className="flex space-x-2">
                  <input
                    type="tel"
                    value={newParticipantNumber}
                    onChange={(e) => setNewParticipantNumber(e.target.value)}
                    placeholder="Enter phone number"
                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                  />
                  <button
                    onClick={addParticipantToConference}
                    disabled={!newParticipantNumber.trim() || isAddingParticipant}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 text-sm"
                  >
                    {isAddingParticipant ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
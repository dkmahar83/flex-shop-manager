import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

// ─── PageLock wrapper ─────────────────────────────────────────────────────────
// Usage: wrap your page with <PageLock pageKey="accounts" pageTitle="Accounts"> ... </PageLock>
// pageKey: 'accounts' or 'employees'

export default function PageLock({ pageKey, pageTitle, children }) {
  const [status, setStatus] = useState('loading'); // loading | locked | unlocked | no-pin
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef(null);

  async function checkLockStatus() {
    try {
      const res = await api.get(`/page-locks/${pageKey}`);
      const { is_locked, has_pin } = res.data;
      if (!has_pin) {
        setStatus('no-pin'); // PIN never set, show setup screen
      } else if (is_locked) {
        setStatus('locked');
      } else {
        setStatus('unlocked');
      }
    } catch {
      setStatus('unlocked'); // If error, don't block
    }
  }

  async function handleVerify() {
    if (pin.length < 4) { setError('4 digit PIN daalo'); return; }
    setVerifying(true);
    setError('');
    try {
      await api.post(`/page-locks/${pageKey}/verify`, { pin });
      setStatus('unlocked');
      setPin('');
    } catch (e) {
      setError(e.response?.data?.error || 'Galat PIN');
      setPin('');
      inputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkLockStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  useEffect(() => {
    if (status === 'locked' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [status]);

  const handlePinKey = (e) => {
    if (e.key === 'Enter') handleVerify();
  };

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <div style={{ color: '#888' }}>Loading...</div>
      </div>
    );
  }

  if (status === 'unlocked') {
    return (
      <>
        {children}
        <LockSettingsButton pageKey={pageKey} pageTitle={pageTitle} onLock={() => setStatus('locked')} />
      </>
    );
  }

  // LOCKED or NO-PIN screen
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: '20px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '40px 36px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center',
        maxWidth: '320px', width: '100%', border: '1px solid #eee'
      }}>

        {/* Lock icon */}
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>
          {status === 'no-pin' ? '🔐' : '🔒'}
        </div>

        <h2 style={{ margin: '0 0 6px', fontSize: '18px', color: '#333' }}>
          {status === 'no-pin' ? 'PIN Set Karo' : `${pageTitle} Locked`}
        </h2>

        <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#888', lineHeight: '1.5' }}>
          {status === 'no-pin'
            ? 'Is page ko protect karne ke liye pehle PIN set karo'
            : 'Access ke liye apna PIN daalo'
          }
        </p>

        {status === 'locked' ? (
          <PinEntry
            pin={pin}
            setPin={setPin}
            error={error}
            verifying={verifying}
            inputRef={inputRef}
            onVerify={handleVerify}
            onKeyDown={handlePinKey}
          />
        ) : (
          <SetPinForm pageKey={pageKey} onSuccess={() => setStatus('locked')} />
        )}
      </div>
    </div>
  );
}

// ─── PIN Entry (number pad style) ─────────────────────────────────────────────
function PinEntry({ pin, setPin, error, verifying, inputRef, onVerify, onKeyDown }) {
  const digits = [1,2,3,4,5,6,7,8,9,'',0,'⌫'];

  const handleDigit = (d) => {
    if (d === '⌫') { setPin(p => p.slice(0, -1)); return; }
    if (d === '') return;
    if (pin.length >= 6) return;
    setPin(p => p + String(d));
  };

  return (
    <>
      {/* PIN dots display */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{
            width: '14px', height: '14px', borderRadius: '50%',
            background: i < pin.length ? '#e65100' : '#e0e0e0',
            transition: 'background 0.1s'
          }} />
        ))}
      </div>

      {/* Hidden input for keyboard entry */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        value={pin}
        onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0,6))}
        onKeyDown={onKeyDown}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />

      {/* Number pad */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px', maxWidth: '240px', margin: '0 auto 16px'
      }}>
        {digits.map((d, i) => (
          <button
            key={i}
            onClick={() => handleDigit(d)}
            style={{
              padding: '14px', fontSize: d === '⌫' ? '18px' : '20px',
              fontWeight: '500', border: '1px solid #eee', borderRadius: '10px',
              background: d === '' ? 'transparent' : '#fafafa',
              cursor: d === '' ? 'default' : 'pointer',
              color: '#333', transition: 'background 0.1s',
              visibility: d === '' ? 'hidden' : 'visible'
            }}
            onMouseEnter={e => { if (d !== '') e.target.style.background = '#fff3e0'; }}
            onMouseLeave={e => { if (d !== '') e.target.style.background = '#fafafa'; }}
          >
            {d}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ color: '#c62828', fontSize: '13px', marginBottom: '12px', fontWeight: '500' }}>
          ⚠ {error}
        </div>
      )}

      <button
        onClick={onVerify}
        disabled={verifying || pin.length < 4}
        style={{
          width: '100%', padding: '12px',
          background: pin.length >= 4 ? '#e65100' : '#ccc',
          color: '#fff', border: 'none', borderRadius: '8px',
          fontSize: '14px', fontWeight: '600', cursor: pin.length >= 4 ? 'pointer' : 'not-allowed'
        }}
      >
        {verifying ? 'Verify ho raha hai...' : 'Unlock'}
      </button>
    </>
  );
}

// ─── Set PIN form ──────────────────────────────────────────────────────────────
function SetPinForm({ pageKey, onSuccess }) {
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSet = async () => {
    if (newPin.length < 4) { setErr('Kam se kam 4 digits'); return; }
    if (newPin !== confirmPin) { setErr('PIN match nahi kiya'); return; }
    setSaving(true);
    try {
      await api.post(`/page-locks/${pageKey}/set-pin`, { pin: newPin });
      onSuccess();
    } catch (e) {
      setErr(e.response?.data?.error || 'Error aaya');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
          New PIN (4-6 digits)
        </label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={newPin}
          onChange={e => setNewPin(e.target.value.replace(/\D/g,''))}
          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '18px', letterSpacing: '8px', textAlign: 'center', boxSizing: 'border-box' }}
          placeholder="••••"
        />
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
          Confirm PIN
        </label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={confirmPin}
          onChange={e => setConfirmPin(e.target.value.replace(/\D/g,''))}
          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '18px', letterSpacing: '8px', textAlign: 'center', boxSizing: 'border-box' }}
          placeholder="••••"
        />
      </div>
      {err && <div style={{ color: '#c62828', fontSize: '13px', marginBottom: '10px' }}>⚠ {err}</div>}
      <button
        onClick={handleSet}
        disabled={saving}
        style={{ width: '100%', padding: '12px', background: '#e65100', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
      >
        {saving ? 'Set ho raha hai...' : '🔐 PIN Set Karo'}
      </button>
    </div>
  );
}

// ─── Lock Settings Button (shown when unlocked) ────────────────────────────────
function LockSettingsButton({ pageKey, pageTitle, onLock }) {
  const [showPanel, setShowPanel] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const handleLockNow = async () => {
    try {
      await api.post(`/page-locks/${pageKey}/toggle`, { is_locked: true });
      onLock();
    } catch {
      alert('Lock nahi hua');
    }
  };

  const handleChangePin = async () => {
    if (newPin !== confirmPin) { setMsg('PIN match nahi kiya'); return; }
    if (newPin.length < 4) { setMsg('4 digits minimum'); return; }
    setSaving(true);
    try {
      await api.post(`/page-locks/${pageKey}/set-pin`, { pin: newPin, current_pin: currentPin });
      setMsg('✓ PIN change ho gaya');
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
      <button
        onClick={() => setShowPanel(!showPanel)}
        style={{
          background: '#333', color: '#fff', border: 'none', borderRadius: '50px',
          padding: '8px 16px', fontSize: '12px', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}
      >
        🔒 Lock Settings
      </button>

      {showPanel && (
        <div style={{
          position: 'absolute', bottom: '44px', right: 0,
          background: '#fff', borderRadius: '12px', padding: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', width: '240px',
          border: '1px solid #eee'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '12px', fontSize: '13px' }}>
            {pageTitle} Lock Settings
          </div>

          <button
            onClick={handleLockNow}
            style={{
              width: '100%', padding: '8px', marginBottom: '12px',
              background: '#e65100', color: '#fff', border: 'none',
              borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
            }}
          >
            🔒 Abhi Lock Karo
          </button>

          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
            PIN Change Karo
          </div>

          {[
            { label: 'Current PIN', val: currentPin, set: setCurrentPin },
            { label: 'New PIN', val: newPin, set: setNewPin },
            { label: 'Confirm New PIN', val: confirmPin, set: setConfirmPin },
          ].map(({ label, val, set }) => (
            <input
              key={label}
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder={label}
              value={val}
              onChange={e => set(e.target.value.replace(/\D/g,''))}
              style={{
                width: '100%', marginBottom: '6px', padding: '7px 10px',
                border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
          ))}

          {msg && <div style={{ fontSize: '12px', color: msg.startsWith('✓') ? '#2e7d32' : '#c62828', marginBottom: '8px' }}>{msg}</div>}

          <button
            onClick={handleChangePin}
            disabled={saving}
            style={{
              width: '100%', padding: '8px', background: '#1565c0',
              color: '#fff', border: 'none', borderRadius: '6px',
              cursor: 'pointer', fontSize: '12px'
            }}
          >
            {saving ? 'Saving...' : 'PIN Change Karo'}
          </button>

          <button
            onClick={() => setShowPanel(false)}
            style={{
              width: '100%', padding: '6px', marginTop: '8px', background: 'none',
              border: '1px solid #eee', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#888'
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

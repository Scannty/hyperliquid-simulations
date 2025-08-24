import React, { useState, useEffect } from 'react';
import { forkService, type Fork } from '../services/forkService';

interface ForkWithCreatedAt extends Fork {
  createdAt: Date;
  duration: number;
}

export default function ForkManager() {
  const [forks, setForks] = useState<ForkWithCreatedAt[]>([]);
  const [forkDuration, setForkDuration] = useState(30);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingFork, setDeletingFork] = useState<string | null>(null);

  const handleCreateFork = async () => {
    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const fork = await forkService.createFork(forkDuration);
      const newFork: ForkWithCreatedAt = {
        ...fork,
        createdAt: new Date(),
        duration: forkDuration,
      };
      setForks(prev => [...prev, newFork]);
      setSuccess(`Fork created successfully: ${fork.forkId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create fork');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteFork = async (forkId: string) => {
    setDeletingFork(forkId);
    setError(null);
    setSuccess(null);

    try {
      await forkService.deleteFork(forkId);
      setForks(prev => prev.filter(fork => fork.forkId !== forkId));
      setSuccess(`Fork ${forkId} deleted successfully`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to delete fork');
    } finally {
      setDeletingFork(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
  };

  const getRemainingTime = (fork: ForkWithCreatedAt) => {
    const now = new Date();
    const elapsedMinutes = Math.floor((now.getTime() - fork.createdAt.getTime()) / (1000 * 60));
    const remainingMinutes = Math.max(0, fork.duration - elapsedMinutes);
    
    if (remainingMinutes === 0) {
      return 'Expired';
    }
    
    if (remainingMinutes < 60) {
      return `${remainingMinutes}m`;
    }
    
    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  useEffect(() => {
    // Auto-refresh remaining times every minute
    const interval = setInterval(() => {
      setForks(prev => [...prev]); // Force re-render to update times
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="form-container">
        <h2 style={{ marginBottom: '2rem', color: 'var(--tn-fg)' }}>Fork Manager</h2>
        
        {error && (
          <div className="error-message" style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--tn-red)', color: 'var(--tn-bg)', borderRadius: '4px' }}>
            {error}
          </div>
        )}
        
        {success && (
          <div className="success-message" style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--tn-green)', color: 'var(--tn-bg)', borderRadius: '4px' }}>
            {success}
          </div>
        )}

        <div className="terminal-container">
          <h3 style={{ marginBottom: '1rem', color: 'var(--tn-cyan)' }}>Create New Fork</h3>
          
          <div className="form-group">
            <label className="form-label">Fork Duration (minutes)</label>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <input
                type="number"
                className="form-input"
                value={forkDuration}
                onChange={(e) => setForkDuration(parseInt(e.target.value) || 30)}
                min="1"
                max="120"
                style={{ flex: 1 }}
              />
              <button
                className="btn"
                onClick={handleCreateFork}
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Fork'}
              </button>
            </div>
            <small style={{ color: 'var(--tn-comment)', fontSize: '0.75rem' }}>
              Duration between 1-120 minutes
            </small>
          </div>
        </div>

        <div className="terminal-container">
          <h3 style={{ marginBottom: '1rem', color: 'var(--tn-cyan)' }}>
            Active Forks ({forks.length})
          </h3>
          
          {forks.length === 0 ? (
            <div style={{ color: 'var(--tn-comment)', fontStyle: 'italic' }}>
              No active forks. Create one to get started.
            </div>
          ) : (
            <div className="forks-list">
              {forks.map((fork) => {
                const remainingTime = getRemainingTime(fork);
                const isExpired = remainingTime === 'Expired';
                
                return (
                  <div key={fork.forkId} className="fork-item" style={{ 
                    padding: '1rem', 
                    border: `1px solid ${isExpired ? 'var(--tn-red)' : 'var(--tn-dark3)'}`, 
                    borderRadius: '4px', 
                    marginBottom: '0.5rem',
                    backgroundColor: 'var(--tn-bg-darker)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span style={{ color: 'var(--tn-fg)', fontWeight: 'bold' }}>
                            {fork.forkId}
                          </span>
                          <span style={{ 
                            padding: '0.25rem 0.5rem', 
                            fontSize: '0.75rem',
                            backgroundColor: isExpired ? 'var(--tn-red)' : remainingTime.includes('h') ? 'var(--tn-green)' : 'var(--tn-yellow)',
                            color: 'var(--tn-bg)',
                            borderRadius: '3px'
                          }}>
                            {remainingTime}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--tn-comment)' }}>
                          <div>RPC URL: {fork.rpcUrl}</div>
                          <div>Created: {fork.createdAt.toLocaleString()}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn secondary"
                          onClick={() => copyToClipboard(fork.forkId)}
                          style={{ padding: '0.5rem', fontSize: '0.75rem' }}
                          title="Copy Fork ID"
                        >
                          Copy ID
                        </button>
                        <button
                          className="btn"
                          onClick={() => handleDeleteFork(fork.forkId)}
                          disabled={deletingFork === fork.forkId}
                          style={{ 
                            padding: '0.5rem', 
                            fontSize: '0.75rem',
                            backgroundColor: 'var(--tn-red)'
                          }}
                          title="Delete Fork"
                        >
                          {deletingFork === fork.forkId ? 'Deleting...' : 'Delete'}
                        </button>
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
  );
}
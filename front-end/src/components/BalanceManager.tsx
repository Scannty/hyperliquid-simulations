import React, { useState } from 'react';
import { forkService } from '../services/forkService';

export default function BalanceManager() {
  const [forkId, setForkId] = useState('');
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [currentBalance, setCurrentBalance] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [operation, setOperation] = useState<'eth' | 'erc20'>('eth');

  const handleGetBalance = async () => {
    if (!forkId || !address) {
      setError('Fork ID and Address are required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let result: string;
      if (operation === 'eth') {
        result = await forkService.getBalance(forkId, address);
      } else {
        if (!tokenAddress) {
          setError('Token address is required for ERC20 balance');
          setIsLoading(false);
          return;
        }
        result = await forkService.getERC20Balance(forkId, address, tokenAddress);
      }
      setCurrentBalance(result);
      setSuccess(`Balance retrieved successfully`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to get balance');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetBalance = async () => {
    if (!forkId || !address || !balance) {
      setError('Fork ID, Address, and Balance are required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let result: string;
      if (operation === 'eth') {
        result = await forkService.setBalance(forkId, address, balance);
      } else {
        if (!tokenAddress) {
          setError('Token address is required for ERC20 balance');
          setIsLoading(false);
          return;
        }
        result = await forkService.setERC20Balance(forkId, address, tokenAddress, balance);
      }
      setSuccess(result);
      // Refresh the balance after setting
      handleGetBalance();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to set balance');
    } finally {
      setIsLoading(false);
    }
  };

  const formatBalance = (balance: string) => {
    if (!balance) return '0';
    const num = parseFloat(balance);
    return num.toLocaleString();
  };

  return (
    <div>
      <div className="form-container">
        <h2 style={{ marginBottom: '2rem', color: 'var(--tn-fg)' }}>Balance Manager</h2>
        
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
          <h3 style={{ marginBottom: '1rem', color: 'var(--tn-cyan)' }}>Balance Operations</h3>
          
          <div className="form-group">
            <label className="form-label">Operation Type</label>
            <div className="toggle-buttons">
              <button
                type="button"
                className={`toggle-btn ${operation === 'eth' ? 'active' : ''}`}
                onClick={() => setOperation('eth')}
              >
                ETH Balance
              </button>
              <button
                type="button"
                className={`toggle-btn ${operation === 'erc20' ? 'active' : ''}`}
                onClick={() => setOperation('erc20')}
              >
                ERC20 Token Balance
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Fork ID</label>
              <input
                type="text"
                className="form-input"
                value={forkId}
                onChange={(e) => setForkId(e.target.value)}
                placeholder="Enter fork ID"
              />
              <small style={{ color: 'var(--tn-comment)', fontSize: '0.75rem' }}>
                The fork instance to operate on
              </small>
            </div>

            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Account Address</label>
              <input
                type="text"
                className="form-input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
              />
              <small style={{ color: 'var(--tn-comment)', fontSize: '0.75rem' }}>
                The account address to check/modify
              </small>
            </div>
          </div>

          {operation === 'erc20' && (
            <div className="form-group">
              <label className="form-label">Token Contract Address</label>
              <input
                type="text"
                className="form-input"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                placeholder="0x..."
              />
              <small style={{ color: 'var(--tn-comment)', fontSize: '0.75rem' }}>
                The ERC20 token contract address
              </small>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">
                New {operation === 'eth' ? 'ETH' : 'Token'} Balance
              </label>
              <input
                type="text"
                className="form-input"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="1000000000000000000"
              />
              <small style={{ color: 'var(--tn-comment)', fontSize: '0.75rem' }}>
                {operation === 'eth' ? 'Balance in wei (18 decimals)' : 'Balance in token units'}
              </small>
            </div>

            {currentBalance !== null && (
              <div style={{ minWidth: '150px', marginTop: '1.5rem' }}>
                <div style={{ color: 'var(--tn-comment)', fontSize: '0.875rem' }}>
                  Current Balance:
                </div>
                <div style={{ color: 'var(--tn-blue)', fontSize: '1.25rem', fontWeight: 'bold' }}>
                  {formatBalance(currentBalance)}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button
              className="btn secondary"
              onClick={handleGetBalance}
              disabled={isLoading || !forkId || !address}
            >
              {isLoading ? 'Loading...' : 'Get Balance'}
            </button>

            <button
              className="btn"
              onClick={handleSetBalance}
              disabled={isLoading || !forkId || !address || !balance}
            >
              {isLoading ? 'Setting...' : 'Set Balance'}
            </button>
          </div>
        </div>

        <div className="terminal-container">
          <h3 style={{ marginBottom: '1rem', color: 'var(--tn-cyan)' }}>Quick Balance Examples</h3>
          <div style={{ color: 'var(--tn-comment)', marginBottom: '1rem' }}>
            Common balance values for reference:
          </div>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--tn-fg)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                ETH Amounts (in wei):
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--tn-comment)' }}>
                <div>• 1 ETH = 1000000000000000000</div>
                <div>• 10 ETH = 10000000000000000000</div>
                <div>• 100 ETH = 100000000000000000000</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--tn-fg)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Token Amounts:
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--tn-comment)' }}>
                <div>• Check token decimals first</div>
                <div>• USDC: 6 decimals (1 USDC = 1000000)</div>
                <div>• Most tokens: 18 decimals</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
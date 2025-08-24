import React, { useState } from 'react';
import { forkService, type SimulationResult } from '../services/forkService';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface TransactionData {
  from: string;
  to: string;
  calldata: string;
  blockNumber?: string;
  value?: string;
  gas?: string;
  gasPrice?: string;
}

export default function TransactionSimulator() {
  const [txData, setTxData] = useState<TransactionData>({
    from: '',
    to: '',
    calldata: '',
    blockNumber: 'latest',
    value: '0',
    gas: '',
    gasPrice: '',
  });
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [sourceCodes, setSourceCodes] = useState<{ [address: string]: { [filename: string]: string } }>({});
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    contracts: true,
    trace: false,
    source: false
  });

  const handleInputChange = (field: keyof TransactionData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setTxData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSimulate = async () => {
    if (!txData.from || !txData.to || !txData.calldata) {
      setError('From address, To address, and Calldata are required');
      return;
    }

    setIsSimulating(true);
    setError(null);
    setSuccess(null);
    setSimulationResult(null);
    setSourceCodes({});

    try {
      const rawTxData = {
        jsonrpc: "2.0",
        method: "eth_call",
        params: [
          {
            from: txData.from,
            to: txData.to,
            data: txData.calldata,
            ...(txData.value && txData.value !== '0' && { value: txData.value }),
            ...(txData.gas && { gas: txData.gas }),
            ...(txData.gasPrice && { gasPrice: txData.gasPrice }),
          },
          txData.blockNumber || "latest"
        ],
        id: 1
      };

      // Extract block number for fork creation (only numeric blocks, not 'latest', 'pending', 'earliest')
      const blockNumberForFork = txData.blockNumber && 
        txData.blockNumber !== 'latest' && 
        txData.blockNumber !== 'pending' && 
        txData.blockNumber !== 'earliest' && 
        /^\d+$/.test(txData.blockNumber) 
        ? txData.blockNumber 
        : undefined;

      const result = await forkService.simulateRawTransaction(rawTxData, blockNumberForFork);
      setSimulationResult(result);

      // Fetch source codes for all contracts in the trace
      if (result.debugTrace && result.debugTrace.length > 0) {
        const uniqueAddresses = [...new Set(result.debugTrace.map(trace => trace.ContractAddress))];
        const codes: { [address: string]: { [filename: string]: string } } = {};
        
        for (const address of uniqueAddresses) {
          if (typeof address === 'string' && address) {
            try {
              codes[address] = await forkService.getSourceCode(address);
            } catch (sourceErr) {
              console.warn(`Failed to fetch source code for ${address}:`, sourceErr);
              codes[address] = { 'unknown.sol': '// Source code not available' };
            }
          }
        }
        setSourceCodes(codes);
      }

      if (result.revertReason) {
        setError(`Transaction reverted: ${result.revertReason}`);
      } else {
        setSuccess('Transaction simulated successfully!');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  const clearForm = () => {
    setTxData({
      from: '',
      to: '',
      calldata: '',
      blockNumber: 'latest',
      value: '0',
      gas: '',
      gasPrice: '',
    });
    setSimulationResult(null);
    setSourceCodes({});
    setError(null);
    setSuccess(null);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div>
      <div className="form-container">
        <h2 style={{ marginBottom: '2rem', color: 'var(--tn-fg)' }}>Transaction Simulator</h2>
        
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
          <h3 style={{ marginBottom: '1rem', color: 'var(--tn-cyan)' }}>Transaction Details</h3>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">From Address</label>
              <input
                type="text"
                className="form-input"
                value={txData.from}
                onChange={handleInputChange('from')}
                placeholder="0x..."
                required
              />
              <small style={{ color: 'var(--tn-comment)', fontSize: '0.75rem' }}>
                The address initiating the transaction
              </small>
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">To Address</label>
              <input
                type="text"
                className="form-input"
                value={txData.to}
                onChange={handleInputChange('to')}
                placeholder="0x..."
                required
              />
              <small style={{ color: 'var(--tn-comment)', fontSize: '0.75rem' }}>
                The contract address to call
              </small>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Calldata</label>
            <textarea
              className="form-textarea"
              value={txData.calldata}
              onChange={handleInputChange('calldata')}
              placeholder="0x..."
              required
              rows={3}
            />
            <small style={{ color: 'var(--tn-comment)', fontSize: '0.75rem' }}>
              The encoded function call data
            </small>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Value (wei)</label>
              <input
                type="text"
                className="form-input"
                value={txData.value}
                onChange={handleInputChange('value')}
                placeholder="0"
              />
              <small style={{ color: 'var(--tn-comment)', fontSize: '0.75rem' }}>
                ETH amount to send (optional)
              </small>
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Gas Limit</label>
              <input
                type="text"
                className="form-input"
                value={txData.gas}
                onChange={handleInputChange('gas')}
                placeholder="Auto"
              />
              <small style={{ color: 'var(--tn-comment)', fontSize: '0.75rem' }}>
                Gas limit (optional)
              </small>
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Block Number</label>
              <input
                type="text"
                className="form-input"
                value={txData.blockNumber}
                onChange={handleInputChange('blockNumber')}
                placeholder="latest, pending, earliest, or block number"
              />
              <small style={{ color: 'var(--tn-comment)', fontSize: '0.75rem' }}>
                Block to simulate at
              </small>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button
              className="btn"
              onClick={handleSimulate}
              disabled={isSimulating || !txData.from || !txData.to || !txData.calldata}
            >
              {isSimulating ? 'Simulating...' : 'Simulate Transaction'}
            </button>
            <button className="btn secondary" onClick={clearForm}>
              Clear
            </button>
          </div>
        </div>

        {simulationResult && (
          <div className="terminal-container">
            <h3 style={{ marginBottom: '1rem', color: 'var(--tn-cyan)' }}>Simulation Results</h3>

            {simulationResult.revertReason && (
              <div style={{ 
                padding: '1rem', 
                backgroundColor: 'var(--tn-red)', 
                color: 'var(--tn-bg)', 
                borderRadius: '4px', 
                marginBottom: '1rem' 
              }}>
                <strong>Transaction Reverted:</strong> {simulationResult.revertReason}
                {simulationResult.lineNumber > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    Error at line: {simulationResult.lineNumber}
                  </div>
                )}
              </div>
            )}

            {/* Contracts Called Section */}
            <div style={{ marginBottom: '1rem' }}>
              <button
                className="btn secondary"
                onClick={() => toggleSection('contracts')}
                style={{ marginBottom: '0.5rem' }}
              >
                {expandedSections.contracts ? '▼' : '▶'} Contracts Called ({simulationResult.contractsCalled.length})
              </button>
              {expandedSections.contracts && (
                <div className="trace-output" style={{ marginTop: '0.5rem' }}>
                  {simulationResult.contractsCalled.map((contract, index) => (
                    <div key={index} style={{ 
                      padding: '1rem', 
                      border: '1px solid var(--tn-dark3)', 
                      borderRadius: '4px', 
                      marginBottom: '0.5rem',
                      backgroundColor: 'var(--tn-bg-dark)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--tn-fg)', fontWeight: 'bold' }}>
                          {contract.contractAddress}
                        </span>
                        <span style={{ 
                          padding: '0.25rem 0.5rem', 
                          fontSize: '0.75rem',
                          backgroundColor: 'var(--tn-blue)',
                          color: 'var(--tn-bg)',
                          borderRadius: '3px'
                        }}>
                          {contract.callType}
                        </span>
                      </div>
                      <div style={{ color: 'var(--tn-comment)', fontSize: '0.875rem' }}>
                        Function: {contract.functionSignature}
                      </div>
                      {contract.arguments.length > 0 && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <div style={{ color: 'var(--tn-comment)', fontSize: '0.75rem' }}>
                            Arguments:
                          </div>
                          {contract.arguments.map((arg, argIndex) => (
                            <div key={argIndex} style={{ marginLeft: '1rem', fontSize: '0.875rem' }}>
                              {arg.name} ({arg.type}): {arg.value}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Debug Trace Section */}
            <div style={{ marginBottom: '1rem' }}>
              <button
                className="btn secondary"
                onClick={() => toggleSection('trace')}
                style={{ marginBottom: '0.5rem' }}
              >
                {expandedSections.trace ? '▼' : '▶'} Debug Trace ({simulationResult.debugTrace.length} steps)
              </button>
              {expandedSections.trace && (
                <div className="trace-output" style={{ maxHeight: '400px', overflow: 'auto', marginTop: '0.5rem' }}>
                  {simulationResult.debugTrace.map((trace, index) => (
                    <div key={index} style={{ 
                      padding: '0.5rem', 
                      border: '1px solid var(--tn-dark3)', 
                      borderRadius: '4px', 
                      marginBottom: '0.25rem',
                      fontSize: '0.75rem',
                      backgroundColor: 'var(--tn-bg-dark)'
                    }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span style={{ width: '60px', color: 'var(--tn-comment)' }}>
                          Step {index + 1}
                        </span>
                        <span style={{ width: '100px', color: 'var(--tn-fg)' }}>
                          {trace.Opcode}
                        </span>
                        <span style={{ flex: 1, color: 'var(--tn-comment)' }}>
                          {trace.File}:{trace.LineNumber}
                        </span>
                        <span style={{ width: '250px', color: 'var(--tn-comment)', fontSize: '0.7rem' }}>
                          {trace.ContractAddress}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Source Code Section */}
            {Object.keys(sourceCodes).length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <button
                  className="btn secondary"
                  onClick={() => toggleSection('source')}
                  style={{ marginBottom: '0.5rem' }}
                >
                  {expandedSections.source ? '▼' : '▶'} Source Code ({Object.keys(sourceCodes).length} contracts)
                </button>
                {expandedSections.source && (
                  <div style={{ marginTop: '0.5rem' }}>
                    {Object.entries(sourceCodes).map(([address, files]) => (
                      <div key={address} style={{ marginBottom: '2rem' }}>
                        <h4 style={{ color: 'var(--tn-fg)', marginBottom: '1rem' }}>
                          {address}
                        </h4>
                        {Object.entries(files).map(([filename, code]) => (
                          <div key={filename} style={{ marginBottom: '1rem' }}>
                            <div style={{ color: 'var(--tn-comment)', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                              {filename}
                            </div>
                            <SyntaxHighlighter
                              language="solidity"
                              style={atomDark}
                              customStyle={{ fontSize: '0.75rem', maxHeight: '300px' }}
                            >
                              {code}
                            </SyntaxHighlighter>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
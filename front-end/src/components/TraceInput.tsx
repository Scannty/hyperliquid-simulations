import React, { useState } from "react";
import BlockchainSelect from "./BlockchainSelect";

interface TraceInputProps {
  onTrace: (data: TraceData) => void;
  isLoading: boolean;
}

interface TraceData {
  from: string;
  to: string;
  calldata: string;
  blockchain: string;
  blockNumber?: string;
  transactionHash?: string;
}

const TraceInput: React.FC<TraceInputProps> = ({ onTrace, isLoading }) => {
  const [formData, setFormData] = useState<TraceData>({
    from: "",
    to: "",
    calldata: "",
    blockchain: "hyperliquid",
    blockNumber: "",
  });

  const [errors, setErrors] = useState<Partial<TraceData & { functionSignature?: string; parameters?: string; transactionHash?: string }>>({});
  const [inputMode, setInputMode] = useState<'manual' | 'function' | 'txhash' | 'txhash-only'>('manual');
  const [functionSignature, setFunctionSignature] = useState('');
  const [parameters, setParameters] = useState('');
  const [encodingLoading, setEncodingLoading] = useState(false);
  const [transactionHash, setTransactionHash] = useState('');
  const [fetchingTxData, setFetchingTxData] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<TraceData & { transactionHash?: string }> = {};

    // For transaction hash only mode, only validate the transaction hash
    if (inputMode === 'txhash-only') {
      if (!transactionHash.trim()) {
        newErrors.transactionHash = 'Transaction hash is required';
      } else if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash.trim())) {
        newErrors.transactionHash = 'Invalid transaction hash format';
      }
    } else {
      // For other modes, validate the normal fields
      if (!formData.from.trim()) {
        newErrors.from = "From address is required";
      } else if (!/^0x[a-fA-F0-9]{40}$/.test(formData.from)) {
        newErrors.from = "Invalid Ethereum address format";
      }

      if (!formData.to.trim()) {
        newErrors.to = "To address is required";
      } else if (!/^0x[a-fA-F0-9]{40}$/.test(formData.to)) {
        newErrors.to = "Invalid Ethereum address format";
      }

      if (!formData.calldata.trim()) {
        newErrors.calldata = "Calldata is required";
      } else if (!/^0x[a-fA-F0-9]*$/.test(formData.calldata)) {
        newErrors.calldata = "Invalid hex format";
      }

      // Validate block number if provided
      if (formData.blockNumber !== undefined && formData.blockNumber !== null && formData.blockNumber !== "") {
        const blockNumStr = String(formData.blockNumber).trim();
        const blockNum = parseInt(blockNumStr);
        if (isNaN(blockNum) || blockNum < 0) {
          newErrors.blockNumber = "Invalid block number (must be a positive integer)";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const submitData = inputMode === 'txhash-only' 
        ? { ...formData, transactionHash: transactionHash.trim() }
        : formData;
      onTrace(submitData);
    }
  };

  const handleInputChange = (field: keyof TraceData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateFunctionInputs = (): boolean => {
    const newErrors: Partial<TraceData & { functionSignature?: string; parameters?: string }> = {};

    if (!functionSignature.trim()) {
      newErrors.functionSignature = 'Function signature is required';
    } else if (!/^\w+\([^)]*\)$/.test(functionSignature.trim())) {
      newErrors.functionSignature = 'Invalid function signature format (e.g. transfer(address,uint256))';
    }

    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const encodeCalldata = async () => {
    if (!validateFunctionInputs()) {
      return;
    }

    setEncodingLoading(true);
    try {
      const parameterArray = parameters
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/encode-calldata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature: functionSignature,
          parameters: parameterArray,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setFormData(prev => ({ ...prev, calldata: result.calldata }));
        // Clear calldata error if it exists
        if (errors.calldata) {
          setErrors(prev => ({ ...prev, calldata: undefined }));
        }
      } else {
        const errorMessage = result.details || result.error;
        // Determine if error is about signature or parameters
        if (errorMessage.includes('invalid type') || errorMessage.includes('signature')) {
          setErrors(prev => ({ 
            ...prev, 
            functionSignature: `Invalid signature: ${errorMessage}`
          }));
        } else {
          setErrors(prev => ({ 
            ...prev, 
            parameters: `Parameter error: ${errorMessage}`
          }));
        }
      }
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        parameters: `Failed to encode calldata: ${error}`
      }));
    } finally {
      setEncodingLoading(false);
    }
  };

  const validateTransactionHash = (): boolean => {
    const newErrors: Partial<TraceData & { transactionHash?: string }> = {};

    if (!transactionHash.trim()) {
      newErrors.transactionHash = 'Transaction hash is required';
    } else if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash.trim())) {
      newErrors.transactionHash = 'Invalid transaction hash format';
    }

    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const fetchTransactionData = async () => {
    if (!validateTransactionHash()) {
      return;
    }

    setFetchingTxData(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/fetch-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionHash: transactionHash.trim(),
          blockchain: formData.blockchain,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setFormData(prev => ({
          ...prev,
          from: result.from,
          to: result.to,
          calldata: result.calldata,
          blockNumber: result.blockNumber || "", // Include block number if available from transaction data
        }));
        // Clear any existing errors
        setErrors(prev => ({
          ...prev,
          from: undefined,
          to: undefined,
          calldata: undefined,
          transactionHash: undefined,
        }));
      } else {
        setErrors(prev => ({
          ...prev,
          transactionHash: `Failed to fetch transaction: ${result.error}`
        }));
      }
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        transactionHash: `Failed to fetch transaction data: ${error}`
      }));
    } finally {
      setFetchingTxData(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <img
          src="/logo-letters.svg?v=2"
          alt="TraceX Logo"
          style={{ height: "30px", width: "90px" }}
        />
        <div className="blockchain-selector">
          <BlockchainSelect
            value={formData.blockchain}
            onChange={(value) => handleInputChange("blockchain", value)}
            disabled={isLoading || (inputMode === 'txhash') || (inputMode === 'txhash-only')}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {inputMode !== 'txhash-only' && (
          <div className="form-group">
            <label htmlFor="from" className="form-label">
              From Address
            </label>
            <input
              id="from"
              type="text"
              placeholder="0x..."
              value={formData.from}
              onChange={(e) => handleInputChange("from", e.target.value)}
              className={`form-input ${errors.from ? "error" : ""}`}
              disabled={isLoading || (inputMode === 'txhash')}
            />
            {errors.from && <div className="error-message">{errors.from}</div>}
          </div>
        )}

        {inputMode !== 'txhash-only' && (
          <div className="form-group">
            <label htmlFor="to" className="form-label">
              To Address
            </label>
            <input
              id="to"
              type="text"
              placeholder="0x..."
              value={formData.to}
              onChange={(e) => handleInputChange("to", e.target.value)}
              className={`form-input ${errors.to ? "error" : ""}`}
              disabled={isLoading || (inputMode === 'txhash')}
            />
            {errors.to && <div className="error-message">{errors.to}</div>}
          </div>
        )}

        <div className="form-group">
          <div className="input-mode-selector">
            <label className="form-label">Input Mode</label>
            <div className="toggle-buttons">
              <button
                type="button"
                className={`toggle-btn ${inputMode === 'manual' ? 'active' : ''}`}
                onClick={() => setInputMode('manual')}
                disabled={isLoading}
              >
                Manual Calldata
              </button>
              <button
                type="button"
                className={`toggle-btn ${inputMode === 'function' ? 'active' : ''}`}
                onClick={() => setInputMode('function')}
                disabled={isLoading}
              >
                Function Builder
              </button>
              <button
                type="button"
                className={`toggle-btn ${inputMode === 'txhash' ? 'active' : ''}`}
                onClick={() => setInputMode('txhash')}
                disabled={isLoading}
              >
                Transaction Hash
              </button>
              <button
                type="button"
                className={`toggle-btn ${inputMode === 'txhash-only' ? 'active' : ''}`}
                onClick={() => setInputMode('txhash-only')}
                disabled={isLoading}
              >
                Debug TX Hash
              </button>
            </div>
          </div>
        </div>

        {inputMode === 'function' && (
          <>
            <div className="form-group">
              <label htmlFor="functionSignature" className="form-label">
                Function Signature
              </label>
              <input
                id="functionSignature"
                type="text"
                placeholder="transfer(address,uint256)"
                value={functionSignature}
                onChange={(e) => {
                  setFunctionSignature(e.target.value);
                  if (errors.functionSignature) {
                    setErrors(prev => ({ ...prev, functionSignature: undefined }));
                  }
                }}
                className={`form-input ${errors.functionSignature ? 'error' : ''}`}
                disabled={isLoading || encodingLoading}
              />
              {errors.functionSignature && (
                <div className="error-message">{errors.functionSignature}</div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="parameters" className="form-label">
                Parameters (one per line)
              </label>
              <textarea
                id="parameters"
                placeholder="0x1234567890123456789012345678901234567890\n1000000000000000000"
                value={parameters}
                onChange={(e) => {
                  setParameters(e.target.value);
                  if (errors.parameters) {
                    setErrors(prev => ({ ...prev, parameters: undefined }));
                  }
                }}
                className={`form-textarea ${errors.parameters ? 'error' : ''}`}
                disabled={isLoading || encodingLoading}
                rows={3}
              />
              {errors.parameters && (
                <div className="error-message">{errors.parameters}</div>
              )}
            </div>

            <div className="form-group">
              <button
                type="button"
                onClick={encodeCalldata}
                className="btn secondary"
                disabled={isLoading || encodingLoading}
              >
                {encodingLoading ? 'Encoding...' : 'Generate Calldata'}
              </button>
            </div>
          </>
        )}

        {inputMode === 'txhash' && (
          <>
            <div className="form-group">
              <label htmlFor="transactionHash" className="form-label">
                Transaction Hash
              </label>
              <input
                id="transactionHash"
                type="text"
                placeholder="0x1d610142b6d9e43df53268629785086cd70d6325373ec88052dc61ff8c393518"
                value={transactionHash}
                onChange={(e) => {
                  setTransactionHash(e.target.value);
                  if (errors.transactionHash) {
                    setErrors(prev => ({ ...prev, transactionHash: undefined }));
                  }
                }}
                className={`form-input ${errors.transactionHash ? 'error' : ''}`}
                disabled={isLoading || fetchingTxData}
              />
              {errors.transactionHash && (
                <div className="error-message">{errors.transactionHash}</div>
              )}
            </div>

            <div className="form-group">
              <button
                type="button"
                onClick={fetchTransactionData}
                className="btn secondary"
                disabled={isLoading || fetchingTxData}
              >
                {fetchingTxData ? 'Fetching...' : 'Fetch Transaction Data'}
              </button>
            </div>
          </>
        )}

        {inputMode === 'txhash-only' && (
          <div className="form-group">
            <label htmlFor="transactionHashOnly" className="form-label">
              Transaction Hash
            </label>
            <input
              id="transactionHashOnly"
              type="text"
              placeholder="0x1d610142b6d9e43df53268629785086cd70d6325373ec88052dc61ff8c393518"
              value={transactionHash}
              onChange={(e) => {
                setTransactionHash(e.target.value);
                if (errors.transactionHash) {
                  setErrors(prev => ({ ...prev, transactionHash: undefined }));
                }
              }}
              className={`form-input ${errors.transactionHash ? 'error' : ''}`}
              disabled={isLoading}
            />
            {errors.transactionHash && (
              <div className="error-message">{errors.transactionHash}</div>
            )}
            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--tn-comment)' }}>
              Debug an existing transaction by its hash. No need to fill other fields.
            </div>
          </div>
        )}

        {inputMode !== 'txhash-only' && (
          <div className="form-group">
            <label htmlFor="calldata" className="form-label">
              Calldata
            </label>
            <textarea
              id="calldata"
              placeholder="0x..."
              value={formData.calldata}
              onChange={(e) => handleInputChange("calldata", e.target.value)}
              className={`form-textarea ${errors.calldata ? "error" : ""}`}
              disabled={isLoading || (inputMode === 'function') || (inputMode === 'txhash')}
              rows={4}
            />
            {errors.calldata && (
              <div className="error-message">{errors.calldata}</div>
            )}
          </div>
        )}

        {inputMode !== 'txhash-only' && (
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label htmlFor="blockNumber" className="form-label" style={{ margin: 0, minWidth: 'fit-content' }}>
              Block #:
            </label>
            <input
              id="blockNumber"
              type="text"
              placeholder="latest"
              value={formData.blockNumber || ""}
              onChange={(e) => handleInputChange("blockNumber", e.target.value)}
              className={`form-input ${errors.blockNumber ? "error" : ""}`}
              disabled={isLoading}
              style={{ maxWidth: '120px' }}
            />
            <span style={{ fontSize: '0.85em', color: '#666', fontStyle: 'italic' }}>
              (optional - execute at this block)
            </span>
            {errors.blockNumber && <div className="error-message">{errors.blockNumber}</div>}
          </div>
        )}

        <button type="submit" className="btn" disabled={isLoading}>
          {isLoading ? "Processing..." : (inputMode === 'txhash-only' ? "Debug Transaction" : "Trace Transaction")}
        </button>
      </form>
    </div>
  );
};

export default TraceInput;
export type { TraceData };

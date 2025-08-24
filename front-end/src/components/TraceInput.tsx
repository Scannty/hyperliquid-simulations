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

  const [errors, setErrors] = useState<Partial<TraceData & { transactionHash?: string }>>({});
  const [transactionHash, setTransactionHash] = useState('');

  const validateForm = (): boolean => {
    const newErrors: Partial<TraceData & { transactionHash?: string }> = {};

    if (!transactionHash.trim()) {
      newErrors.transactionHash = 'Transaction hash is required';
    } else if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash.trim())) {
      newErrors.transactionHash = 'Invalid transaction hash format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const submitData = { ...formData, transactionHash: transactionHash.trim() };
      onTrace(submitData);
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
            onChange={() => {}}
            disabled={true}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit}>
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
            disabled={isLoading}
          />
          {errors.transactionHash && (
            <div className="error-message">{errors.transactionHash}</div>
          )}
          <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--tn-comment)' }}>
            Enter a transaction hash to debug. The system will automatically create a fork and analyze the transaction.
          </div>
        </div>

        <button type="submit" className="btn" disabled={isLoading}>
          {isLoading ? "Processing..." : "Debug Transaction"}
        </button>
      </form>
    </div>
  );
};

export default TraceInput;
export type { TraceData };

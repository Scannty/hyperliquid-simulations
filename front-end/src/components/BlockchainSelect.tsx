import React, { useEffect, useState, useRef } from 'react';

interface Blockchain {
  name: string;
  rpcUrl: string;
  icon: string;
}

interface BlockchainSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const BlockchainSelect: React.FC<BlockchainSelectProps> = ({ 
  value, 
  onChange, 
  disabled = false 
}) => {
  // Start with fallback data immediately to avoid loading state
  const [blockchains, setBlockchains] = useState<Record<string, Blockchain>>({
    hyperliquid: {
      name: 'Hyperliquid',
      rpcUrl: 'https://rpc.purroofgroup.com',
      icon: 'hyperliquid.svg'
    },
    ethereum: {
      name: 'Ethereum',
      rpcUrl: 'https://mainnet.gateway.tenderly.co',
      icon: 'ethereum.svg'
    }
  });
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchBlockchains = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/blockchains');
        const data = await response.json();
        setBlockchains(data);
      } catch (error) {
        console.error('Failed to fetch blockchains:', error);
        // Keep the fallback data that's already set
      }
    };

    fetchBlockchains();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (chainKey: string) => {
    onChange(chainKey);
    setIsOpen(false);
  };

  return (
    <div className="blockchain-select" ref={dropdownRef}>
      <div 
        className="blockchain-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {blockchains[value] && (
          <>
            <img 
              src={`/${blockchains[value].icon}`} 
              alt={blockchains[value].name}
              className="blockchain-icon"
            />
            <span className="blockchain-name">{blockchains[value].name}</span>
            <svg 
              className={`blockchain-arrow ${isOpen ? 'open' : ''}`} 
              width="16" 
              height="16" 
              viewBox="0 0 16 16" 
              fill="none"
            >
              <path 
                d="M3 6.5L8 11.5L13 6.5" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </>
        )}
      </div>

      {isOpen && (
        <div className="blockchain-dropdown">
          <div className="blockchain-dropdown-list">
            {Object.entries(blockchains).map(([key, blockchain]) => (
              <div
                key={key}
                className={`blockchain-option ${key === value ? 'selected' : ''}`}
                onClick={() => handleSelect(key)}
              >
                <div className="blockchain-option-content">
                  <img 
                    src={`/${blockchain.icon}`} 
                    alt={blockchain.name}
                    className="blockchain-icon"
                  />
                  <span className="blockchain-name">{blockchain.name}</span>
                </div>
                {key === value && (
                  <div className="blockchain-check">
                    <div className="blockchain-check-dot"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockchainSelect; 
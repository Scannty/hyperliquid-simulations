import { useState } from "react";
import axios from "axios";
import TraceInput from "./components/TraceInput";
import type { TraceData } from "./components/TraceInput";
import "./index.css";
import "./App.css";

// Core TypeScript interfaces for the application
interface CallTrace {
  Opcode: string;
  LineNumber: number;
  File: string;
  ContractAddress: string;
}

interface ContractCalled {
  contractAddress: string;
  callType: string;
  functionSignature: string;
  arguments: Array<{
    name: string;
    type: string;
    value: string;
  }>;
}

interface DebugResult {
  contractsCalled: ContractCalled[];
  errorLineNumber: number;
  revertReason: string;
  debugTrace: CallTrace[];
  sourceCodes?: { [address: string]: { [filename: string]: string } };
}

// TraceData interface is now imported from TraceInput component

function App() {
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTransactionHash, setCurrentTransactionHash] = useState<string | null>(null);

  // TODO: Will be used by TraceInput component in Step 3
  const handleTrace = async (data: TraceData) => {
    setIsLoading(true);
    setError(null);
    setDebugResult(null);
    setCurrentTransactionHash(data.transactionHash || null);

    try {
      const API_BASE_URL =
        import.meta.env.VITE_API_URL || "http://localhost:8080";
      
      let contractsCalled, errorLineNumber, revertReason, debugTrace;
      
      if (data.transactionHash) {
        // Use existing transaction hash - hardcode forkId for now
        const hardcodedForkId = "935507cf-cdcc-497a-8eff-e80f9f2d1ccd";
        
        // Get contracts called
        const contractsResponse = await axios.get(`${API_BASE_URL}/debug/contractsCalled/${hardcodedForkId}`, {
          params: { txHash: data.transactionHash }
        });
        console.log("Contracts response:", contractsResponse.data);
        contractsCalled = contractsResponse.data;
        
        // Debug the transaction
        const debugResponse = await axios.get(`${API_BASE_URL}/debug/debugTransaction/${hardcodedForkId}`, {
          params: { txHash: data.transactionHash }
        });
        
        console.log("Debug response:", debugResponse.data);
        
        errorLineNumber = debugResponse.data.LineNumber;
        revertReason = debugResponse.data.RevertReason;
        debugTrace = debugResponse.data.DebugTrace;
        
      } else {
        // Build raw transaction data for simulation
        const rawTxData = {
          jsonrpc: "2.0",
          method: "eth_call",
          params: [
            {
              from: data.from,
              to: data.to,
              data: data.calldata,
            },
            data.blockNumber || "latest"
          ],
          id: 1
        };

        const response = await axios.post(`${API_BASE_URL}/simulate/simulateRawTx`, rawTxData);
        
        // Extract data from response
        ({ contractsCalled, errorLineNumber, revertReason, debugTrace } = response.data);
      }
      
      // Validate that we have the required data
      if (!debugTrace || !Array.isArray(debugTrace)) {
        throw new Error("No debug trace data received from the API");
      }
      
      if (!contractsCalled || !Array.isArray(contractsCalled)) {
        throw new Error("No contracts called data received from the API");
      }

      // Fetch source codes for all contracts
      const sourceCodes: { [address: string]: { [filename: string]: string } } = {};
      const uniqueAddresses = [...new Set(debugTrace.map((trace: CallTrace) => trace.ContractAddress))];
      
      for (const address of uniqueAddresses) {
        if (typeof address === 'string') {
          try {
            const sourceResponse = await axios.get(`${API_BASE_URL}/debug/getSourceCode`, {
              params: { contractAddress: address }
            });
            sourceCodes[address] = sourceResponse.data;
          } catch (sourceErr) {
            console.warn(`Failed to fetch source code for ${address}:`, sourceErr);
            sourceCodes[address] = { 'unknown.sol': '// Source code not available' };
          }
        }
      }

      setDebugResult({
        contractsCalled,
        errorLineNumber,
        revertReason,
        debugTrace,
        sourceCodes
      });
    } catch (err: unknown) {
      const errorMessage = 
        (err as any)?.response?.data?.error || 
        (err as Error)?.message || 
        "An error occurred";
      setError(errorMessage);
      console.error("Debug error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Hyperliquid Simulations</h1>
        <p>Transaction Debugger - Step by Step Execution Analysis</p>
      </header>

      <main>
        <TraceInput onTrace={handleTrace} isLoading={isLoading} />

        {/* Placeholder for TraceOutput component - Step 5 */}
        <div className="card">
          <p>TraceOutput Component (Step 5)</p>
          <p>Debug result available: {!!debugResult}</p>
          {error && <p style={{color: 'red'}}>Error: {error}</p>}
          <p>Transaction Hash: {currentTransactionHash || 'None'}</p>
        </div>
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <span>
            Powered by{" "}
            <a
              href="https://perpflow.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="perpflow-link"
            >
              Perpflow
              <img
                src="/perpflow.svg"
                alt="Perpflow"
                className="perpflow-logo"
              />
            </a>{" "}
            &{" "}
            <a
              href="https://getfoundry.sh"
              target="_blank"
              rel="noopener noreferrer"
            >
              Foundry
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App; 
import { useState } from "react";
import axios from "axios";
import TraceInput from "./components/TraceInput";
import TraceOutput from "./components/TraceOutput";
import type { TraceData } from "./components/TraceInput";
import "./styles/tokyonight.css";

interface CallTrace {
  Opcode: string;
  LineNumber: number;
  File: string;
  ContractAddress: string;
  Depth: number;
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

function App() {
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTransactionHash, setCurrentTransactionHash] = useState<string | null>(null);

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
        const hardcodedForkId = "55630203-6573-4388-8082-ad20140bee98";
        
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
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || err.message || "An error occurred";
      setError(errorMessage);
      console.error("Debug error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <TraceInput onTrace={handleTrace} isLoading={isLoading} />
      <TraceOutput
        debugResult={debugResult}
        isLoading={isLoading}
        error={error || undefined}
        transactionHash={currentTransactionHash || undefined}
      />
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
          <span>
            Built by{" "}
            <a
              href="https://x.com/0xdivergence"
              target="_blank"
              rel="noopener noreferrer"
            >
              @0xdivergence
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;

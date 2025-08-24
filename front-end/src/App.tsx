import { useState } from "react";
import TraceInput from "./components/TraceInput";
import TraceOutput from "./components/TraceOutput";
import ForkManager from "./components/ForkManager";
import BalanceManager from "./components/BalanceManager";
import TransactionSimulator from "./components/TransactionSimulator";
import type { TraceData } from "./components/TraceInput";
import { forkService, type Fork } from "./services/forkService";
import "./styles/tokyonight.css";

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

interface ForkWithCreatedAt extends Fork {
    createdAt: Date;
    duration: number;
}

function App() {
    const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentTransactionHash, setCurrentTransactionHash] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"debugger" | "simulator" | "forks" | "balance">("debugger");
    const [forks, setForks] = useState<ForkWithCreatedAt[]>([]);

    const handleTrace = async (data: TraceData) => {
        setIsLoading(true);
        setError(null);
        setDebugResult(null);
        setCurrentTransactionHash(data.transactionHash || null);

        try {
            let result: DebugResult;

            if (data.transactionHash) {
                // Use the auto-fork creation functionality
                result = await forkService.debugTransactionWithAutoFork(data.transactionHash);
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
                        data.blockNumber || "latest",
                    ],
                    id: 1,
                };

                result = await forkService.debugTransactionWithAutoFork(undefined, rawTxData);
            }

            setDebugResult(result);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || "An error occurred";
            setError(errorMessage);
            console.error("Debug error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="app">
            <div className="app-header">
                <img src="/logo-letters.svg?v=2" alt="TraceX Logo" style={{ height: "30px", width: "90px" }} />
                <nav className="tab-navigation">
                    <div className="toggle-buttons">
                        <button
                            type="button"
                            className={`toggle-btn ${activeTab === "debugger" ? "active" : ""}`}
                            onClick={() => setActiveTab("debugger")}
                        >
                            Debugger
                        </button>
                        <button
                            type="button"
                            className={`toggle-btn ${activeTab === "simulator" ? "active" : ""}`}
                            onClick={() => setActiveTab("simulator")}
                        >
                            Simulator
                        </button>
                        <button
                            type="button"
                            className={`toggle-btn ${activeTab === "forks" ? "active" : ""}`}
                            onClick={() => setActiveTab("forks")}
                        >
                            Fork Manager
                        </button>
                        <button
                            type="button"
                            className={`toggle-btn ${activeTab === "balance" ? "active" : ""}`}
                            onClick={() => setActiveTab("balance")}
                        >
                            Balance Manager
                        </button>
                    </div>
                </nav>
            </div>

            <div className="tab-content">
                {activeTab === "debugger" && (
                    <div>
                        <TraceInput onTrace={handleTrace} isLoading={isLoading} />
                        <TraceOutput
                            debugResult={debugResult}
                            isLoading={isLoading}
                            error={error || undefined}
                            transactionHash={currentTransactionHash || undefined}
                        />
                    </div>
                )}

                {activeTab === "simulator" && <TransactionSimulator />}

                {activeTab === "forks" && <ForkManager forks={forks} setForks={setForks} />}

                {activeTab === "balance" && <BalanceManager />}
            </div>

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
                            <img src="/perpflow.svg" alt="Perpflow" className="perpflow-logo" />
                        </a>{" "}
                        &{" "}
                        <a href="https://getfoundry.sh" target="_blank" rel="noopener noreferrer">
                            Foundry
                        </a>
                    </span>
                </div>
            </footer>
        </div>
    );
}

export default App;

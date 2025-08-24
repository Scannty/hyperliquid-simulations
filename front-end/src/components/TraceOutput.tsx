import React from "react";
import StepperDebugger from "./StepperDebugger";
import "../App.css";

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

interface TraceOutputProps {
    debugResult: DebugResult | null;
    isLoading: boolean;
    error?: string;
    transactionHash?: string;
}

const TraceOutput: React.FC<TraceOutputProps> = ({ debugResult, isLoading, error, transactionHash }) => {
    if (isLoading) {
        return (
            <div className="terminal-container">
                <div className="loading">Simulating transaction and analyzing debug trace...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="terminal-container">
                <div className="error-container">
                    <h3 style={{ color: "var(--tn-red)", marginBottom: "1rem" }}>Error</h3>
                    <pre className="error-output">{error}</pre>
                </div>
            </div>
        );
    }

    if (!debugResult) {
        return (
            <div className="terminal-container">
                <div className="placeholder">
                    <h3 style={{ color: "var(--tn-comment)", marginBottom: "1rem" }}>No debug data</h3>
                    <p style={{ color: "var(--tn-comment)" }}>
                        Enter transaction details above and click "Trace Transaction" to see the step-by-step execution.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="terminal-container">
            <StepperDebugger debugResult={debugResult} transactionHash={transactionHash} />
        </div>
    );
};

export default TraceOutput;

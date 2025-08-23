import React from "react";

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

interface StepperDebuggerProps {
    debugResult: DebugResult;
    transactionHash?: string;
}

const StepperDebugger: React.FC<StepperDebuggerProps> = ({ debugResult, transactionHash }) => {
    return (
        <div className="stepper-debugger-placeholder">
            <h3>Stepper Debugger (Next Implementation)</h3>
            <div style={{ marginBottom: '1rem' }}>
                <strong>Transaction:</strong> {transactionHash || 'Manual Input'}
            </div>
            <div style={{ marginBottom: '1rem' }}>
                <strong>Debug Trace Steps:</strong> {debugResult.debugTrace.length}
            </div>
            <div style={{ marginBottom: '1rem' }}>
                <strong>Contracts Called:</strong> {debugResult.contractsCalled.length}
            </div>
            <div style={{ marginBottom: '1rem' }}>
                <strong>Error Line:</strong> {debugResult.errorLineNumber || 'None'}
            </div>
            <div style={{ marginBottom: '1rem' }}>
                <strong>Revert Reason:</strong> {debugResult.revertReason || 'None'}
            </div>
            <div style={{ 
                background: 'rgba(255, 255, 255, 0.05)', 
                padding: '1rem', 
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '0.9rem'
            }}>
                <div>First trace step: {debugResult.debugTrace[0]?.Opcode || 'N/A'}</div>
                <div>Last trace step: {debugResult.debugTrace[debugResult.debugTrace.length - 1]?.Opcode || 'N/A'}</div>
            </div>
        </div>
    );
};

export default StepperDebugger; 
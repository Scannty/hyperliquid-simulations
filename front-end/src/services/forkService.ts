import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface Fork {
  forkId: string;
  rpcUrl: string;
}

export interface ContractCalled {
  contractAddress: string;
  callType: string;
  functionSignature: string;
  arguments: Array<{
    name: string;
    type: string;
    value: string;
  }>;
}

export interface CallTrace {
  Opcode: string;
  LineNumber: number;
  File: string;
  ContractAddress: string;
}

export interface DebugResult {
  contractsCalled: ContractCalled[];
  errorLineNumber: number;
  revertReason: string;
  debugTrace: CallTrace[];
  sourceCodes?: { [address: string]: { [filename: string]: string } };
}

export interface SimulationResult {
  contractsCalled: ContractCalled[];
  lineNumber: number;
  revertReason: string;
  debugTrace: CallTrace[];
}

export class ForkService {
  // Fork management
  async createFork(forkDuration: number = 30): Promise<Fork> {
    const response = await axios.post(`${API_BASE_URL}/fork?forkDuration=${forkDuration}`);
    return response.data;
  }

  async deleteFork(forkId: string): Promise<string> {
    const response = await axios.delete(`${API_BASE_URL}/fork/${forkId}`);
    return response.data;
  }

  // Balance management
  async getBalance(forkId: string, address: string): Promise<string> {
    const response = await axios.post(`${API_BASE_URL}/fork/getBalance/${forkId}?address=${address}`);
    return response.data;
  }

  async setBalance(forkId: string, address: string, balance: string): Promise<string> {
    const response = await axios.post(`${API_BASE_URL}/fork/setBalance/${forkId}?address=${address}&balance=${balance}`);
    return response.data;
  }

  async getERC20Balance(forkId: string, address: string, tokenAddress: string): Promise<string> {
    const response = await axios.post(`${API_BASE_URL}/fork/getERC20Balance/${forkId}?address=${address}&tokenAddress=${tokenAddress}`);
    return response.data;
  }

  async setERC20Balance(forkId: string, address: string, tokenAddress: string, balance: string): Promise<string> {
    const response = await axios.post(`${API_BASE_URL}/fork/setERC20Balance/${forkId}?address=${address}&tokenAddress=${tokenAddress}&balance=${balance}`);
    return response.data;
  }

  // Debug functionality
  async getContractsCalled(forkId: string, txHash: string): Promise<ContractCalled[]> {
    const response = await axios.get(`${API_BASE_URL}/debug/contractsCalled/${forkId}?txHash=${txHash}`);
    return response.data;
  }

  async debugTransaction(forkId: string, txHash: string): Promise<{ RevertReason: string; LineNumber: number; DebugTrace: CallTrace[] }> {
    const response = await axios.get(`${API_BASE_URL}/debug/debugTransaction/${forkId}?txHash=${txHash}`);
    return response.data;
  }

  async getSourceCode(contractAddress: string): Promise<{ [filename: string]: string }> {
    const response = await axios.get(`${API_BASE_URL}/debug/getSourceCode?contractAddress=${contractAddress}`);
    return response.data;
  }

  // Simulation functionality
  async simulateRawTransaction(txData: any, blockNumber?: string): Promise<SimulationResult> {
    const url = blockNumber 
      ? `${API_BASE_URL}/simulate/simulateRawTx?blockNumber=${blockNumber}`
      : `${API_BASE_URL}/simulate/simulateRawTx`;
    const response = await axios.post(url, txData);
    return response.data;
  }

  // Combined debug functionality (with auto fork creation)
  async debugTransactionWithAutoFork(txHash?: string, txData?: any, blockNumber?: string): Promise<DebugResult> {
    let contractsCalled: ContractCalled[];
    let errorLineNumber: number;
    let revertReason: string;
    let debugTrace: CallTrace[];

    if (txHash) {
      // Create a new fork for debugging
      const fork = await this.createFork(30);
      
      // Get contracts called
      contractsCalled = await this.getContractsCalled(fork.forkId, txHash);
      
      // Debug the transaction
      const debugResult = await this.debugTransaction(fork.forkId, txHash);
      errorLineNumber = debugResult.LineNumber;
      revertReason = debugResult.RevertReason;
      debugTrace = debugResult.DebugTrace;
    } else if (txData) {
      // Use simulation endpoint
      const result = await this.simulateRawTransaction(txData, blockNumber);
      contractsCalled = result.contractsCalled;
      errorLineNumber = result.lineNumber;
      revertReason = result.revertReason;
      debugTrace = result.debugTrace;
    } else {
      throw new Error("Either txHash or txData must be provided");
    }

    // Fetch source codes for all contracts
    const sourceCodes: { [address: string]: { [filename: string]: string } } = {};
    const uniqueAddresses = [...new Set(debugTrace.map((trace: CallTrace) => trace.ContractAddress))];
    
    for (const address of uniqueAddresses) {
      if (typeof address === 'string') {
        try {
          sourceCodes[address] = await this.getSourceCode(address);
        } catch (sourceErr) {
          console.warn(`Failed to fetch source code for ${address}:`, sourceErr);
          sourceCodes[address] = { 'unknown.sol': '// Source code not available' };
        }
      }
    }

    return {
      contractsCalled,
      errorLineNumber,
      revertReason,
      debugTrace,
      sourceCodes
    };
  }
}

export const forkService = new ForkService();
import { BrowserProvider, Log } from 'ethers';

export async function getLogsInBatches(
  provider: BrowserProvider,
  filter: { address?: string; topics?: (string | string[] | null)[] },
  fromBlock: bigint,
  toBlock: bigint,
  batchSize: bigint = 9000n
): Promise<Log[]> {
  const logs: Log[] = [];
  for (let start = fromBlock; start <= toBlock; start += batchSize) {
    const end = start + batchSize - 1n <= toBlock ? start + batchSize - 1n : toBlock;
    const batchLogs = await provider.getLogs({ ...filter, fromBlock: start, toBlock: end });
    logs.push(...batchLogs);
  }
  return logs;
} 
import { fetchData } from './api';
import { formatData } from './utils/formatter';
import { renderUI } from './ui';

async function main() {
  const data = await fetchData('https://api.example.com/data');
  const formattedData = formatData(data);
  renderUI(formattedData);
}

main().catch(console.error);

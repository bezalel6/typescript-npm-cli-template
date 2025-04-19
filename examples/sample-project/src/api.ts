/* eslint-disable @typescript-eslint/no-unsafe-return */
import { handleError } from './utils/error';
import { config } from './config';

export async function fetchData(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    handleError(error);
    throw error;
  }
}

/**
 * Update Google Sheet with option data via your backend server
 * @param {object} option - The option symbol object (label, value)
 * @param {array} data - The enhanced options data
 * @returns {Promise<void>}
 */
export async function updateGoogleSheet(option, data) {
  // Your backend endpoint
  const url = 'http://localhost:4000/api/write-sheet';

  // Prepare the data as a row (customize as needed)
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // "YYYY-MM-DD"
  const time = now.toTimeString().slice(0, 5); // "HH:MM"
  const rows = data.map((item, index) => [option.label, date, time, ...item, index + 1]);
  // console.log("🚀 ~ updateGoogleSheet ~ rows:", rows)

  const body = {
    values: rows,
    indexName: option.label, // Use the option label as the index name
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error('Failed to update Google Sheet');
    }
  } catch (error) {
    console.error('Google Sheet update error:', error);
  }
}

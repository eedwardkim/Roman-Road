// Run this script in the browser console on localhost:3000
// It deletes chart sessions 22-106 from IndexedDB

(async () => {
  const START_SESSION_NUMBER = 22;
  const END_SESSION_NUMBER = 106;

  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    console.error('Refusing to delete sessions: this tab is not localhost.');
    return;
  }

  const userId = localStorage.getItem('keymaxx_user_id');
  if (!userId) {
    console.error('No KeyMaxx local user id found. Nothing deleted.');
    return;
  }

  console.log(`Deleting sessions ${START_SESSION_NUMBER}-${END_SESSION_NUMBER} for user ${userId}...`);

  const response = await fetch('/api/dev/delete-sessions-range', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startSessionNumber: START_SESSION_NUMBER,
      endSessionNumber: END_SESSION_NUMBER,
      userId: userId
    })
  });

  const result = await response.json();

  if (response.ok) {
    console.log('✅ Success:', result);
    alert(`Deleted ${result.deletedCount} sessions (${START_SESSION_NUMBER}-${END_SESSION_NUMBER}). Reloading...`);
    window.location.reload();
  } else {
    console.error('❌ Error:', result);
    alert(`Failed to delete sessions: ${result.error}`);
  }
})();

function formatDayKey(date = new Date()) {
  const utc = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return utc.toISOString().slice(0, 10);
}

module.exports = {
  formatDayKey,
};

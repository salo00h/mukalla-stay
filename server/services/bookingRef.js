module.exports = function generateRef() {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 89999);
  return `MS-${year}-${rand}`;
};

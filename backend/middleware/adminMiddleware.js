// Ye middleware check karega ke user Admin hai ya nahi
const adminMiddleware = (req, res, next) => {
  // req.user humare authMiddleware se aata hai jisme user ka poora data (aur role) hota hai
  if (req.user && req.user.role === 'admin') {
    // Agar banda Admin hai, toh usko agle step (Controller) par bhej do
    next(); 
  } else {
    // Agar banda normal user hai, toh usko mana kar do
    res.status(403).json({ 
      message: 'Access Denied! Sirf Admin ye action perform kar sakta hai.' 
    });
  }
};

module.exports = adminMiddleware;
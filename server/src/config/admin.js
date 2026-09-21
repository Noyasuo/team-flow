const { User } = require('../models');

async function ensureAdminUser(env) {
  const email = env.ADMIN_EMAIL.toLowerCase();
  const username = env.ADMIN_USERNAME.toLowerCase();
  const existingUser = await User.findOne({ email }).select('+password');

  if (!existingUser) {
    await User.create({
      name: 'TeamFlow Admin',
      email,
      username,
      password: env.ADMIN_PASSWORD,
      title: 'System Administrator',
      role: 'ADMIN',
      isActive: true,
    });
    return;
  }

  let changed = false;
  if (existingUser.username !== username) {
    existingUser.username = username;
    changed = true;
  }
  if (existingUser.role !== 'ADMIN') {
    existingUser.role = 'ADMIN';
    changed = true;
  }
  if (!existingUser.isActive) {
    existingUser.isActive = true;
    changed = true;
  }

  if (changed) {
    await existingUser.save();
  }
}

module.exports = { ensureAdminUser };
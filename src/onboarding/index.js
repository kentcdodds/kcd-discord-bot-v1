module.exports = {
  ...require('./handle-new-member'),
  ...require('./handle-new-message'),
  ...require('./handle-updated-message'),
  ...require('./cleanup'),
}

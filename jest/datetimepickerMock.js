// Mock du picker natif pour Jest (le vrai module charge du natif).
//
// Il rend une `View` qui PORTE SES PROPS plutôt que `null` : c'est ce qui
// permet à un test de retrouver le sélecteur par son libellé et de déclencher
// son `onChange`. Avec un `null`, une heure ou une date réglée depuis l'écran
// n'était vérifiable d'aucune façon.
const React = require('react')
const { View } = require('react-native')

module.exports = {
  __esModule: true,
  default: props => React.createElement(View, props),
}

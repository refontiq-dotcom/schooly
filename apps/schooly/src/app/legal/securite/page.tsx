import { LegalShell } from "../legal-shell"

export default function SecuritePage() {
  return (
    <LegalShell
      title="Sécurité, conservation et restitution des données"
      intro="Schooly est conçu pour que l’établissement garde la maîtrise opérationnelle de ses données et puisse les récupérer."
    >
      <h2>1. Mesures de sécurité</h2>
      <ul>
        <li>authentification et contrôle des accès par rôle ;</li>
        <li>séparation des données entre établissements ;</li>
        <li>chiffrement des communications réseau ;</li>
        <li>journalisation des opérations importantes lorsque la fonctionnalité est disponible ;</li>
        <li>sauvegardes et mécanismes de restauration adaptés à l’infrastructure ;</li>
        <li>gestion prudente des secrets et des accès techniques.</li>
      </ul>

      <h2>2. Responsabilité des accès</h2>
      <p>
        L’établissement doit attribuer les rôles uniquement aux personnes concernées, désactiver
        les comptes inutilisés et protéger les identifiants. Refontiq ne peut pas empêcher un usage
        abusif effectué avec des identifiants légitimement fournis mais volontairement partagés.
      </p>

      <h2>3. Journal d’activité</h2>
      <p>
        Selon les modules utilisés, Schooly peut conserver des informations permettant de retracer
        certaines actions administratives, pédagogiques, financières ou de sécurité. Ces journaux
        servent à la sécurité, au diagnostic et à la traçabilité et ne remplacent pas les procédures
        internes de l’établissement.
      </p>

      <h2>4. Export des données</h2>
      <p>
        L’établissement doit pouvoir récupérer les informations disponibles dans Schooly. Les
        fonctionnalités d’export peuvent produire des documents imprimables, notamment en PDF, ainsi
        que des formats structurés lorsque le module concerné le permet.
      </p>

      <h2>5. Départ d’un établissement</h2>
      <p>
        Lorsqu’un établissement cesse d’utiliser Schooly, Refontiq prévoit une procédure de sortie
        permettant de récupérer les données nécessaires avant leur éventuelle suppression ou
        anonymisation, sous réserve des obligations légales de conservation.
      </p>

      <h2>6. Limites de sécurité</h2>
      <p>
        Aucune plateforme connectée à Internet ne peut garantir un risque nul. En cas d’incident
        affectant la sécurité ou la disponibilité, Refontiq prend les mesures raisonnables pour
        contenir, corriger et, lorsque cela est approprié, notifier les parties concernées.
      </p>

      <h2>7. Données de sauvegarde</h2>
      <p>
        Les sauvegardes sont destinées à la continuité et à la restauration du service. Elles peuvent
        rester temporairement conservées après une suppression opérationnelle, conformément aux
        règles techniques et aux obligations applicables.
      </p>

      <h2>8. Demande d’export ou de restitution</h2>
      <p>
        Une demande peut être adressée à Refontiq à refontiq@gmail.com. L’établissement doit fournir
        suffisamment d’informations pour permettre de vérifier son identité et son droit à recevoir
        les données concernées.
      </p>
    </LegalShell>
  )
}

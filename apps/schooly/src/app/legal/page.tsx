import { LegalShell } from "./legal-shell"

export default function LegalPage() {
  return (
    <LegalShell
      title="Mentions légales"
      intro="Informations relatives à l’éditeur, à l’exploitation de Schooly et aux principaux documents applicables."
    >
      <h2>1. Éditeur et exploitant</h2>
      <p>
        <strong>Refontiq</strong> est le propriétaire et l’exploitant de la solution logicielle Schooly.
        Le responsable opérationnel indiqué pour les échanges avec les utilisateurs est
        <strong> Dukoua N&apos;guessan Samuel Junior</strong>.
      </p>
      <p>
        Adresse : Abidjan, Côte d’Ivoire<br />
        Email : refontiq@gmail.com<br />
        Téléphone : +225 01 00 37 29 00
      </p>

      <h2>2. Schooly</h2>
      <p>
        Schooly est une plateforme SaaS destinée à la gestion administrative, pédagogique,
        financière et opérationnelle des établissements scolaires.
      </p>

      <h2>3. Propriété intellectuelle</h2>
      <p>
        Sauf indication contraire, le logiciel Schooly, sa structure, ses interfaces, ses éléments
        graphiques, sa documentation, ses marques, ses textes et ses développements sont exploités
        par Refontiq. Aucun droit de propriété sur le logiciel n’est transféré à l’établissement
        du seul fait de son abonnement.
      </p>

      <h2>4. Données de l’établissement</h2>
      <p>
        L’établissement conserve ses droits sur les données qu’il introduit dans Schooly, sous
        réserve des droits des personnes concernées et des obligations légales applicables.
        Schooly fournit les moyens techniques nécessaires à leur gestion dans le cadre du service.
      </p>

      <h2>5. Documents applicables</h2>
      <p>
        L’utilisation de Schooly est encadrée par les Conditions Générales de Service, la Politique
        de confidentialité, les Conditions tarifaires et la Politique de sécurité.
      </p>

      <h2>6. Droit applicable</h2>
      <p>
        Les documents contractuels de Schooly sont conçus pour être appliqués dans le respect du
        droit ivoirien. Lorsqu’une disposition impérative applicable prévoit une règle différente,
        cette disposition prévaut.
      </p>

      <h2>7. Réclamations</h2>
      <p>
        Toute question ou réclamation doit être adressée en priorité à Refontiq à l’adresse
        refontiq@gmail.com ou au +225 01 00 37 29 00. Il est recommandé de conserver les références
        de toute demande et les documents justificatifs.
      </p>
    </LegalShell>
  )
}

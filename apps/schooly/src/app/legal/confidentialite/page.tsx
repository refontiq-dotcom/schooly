import { LegalShell } from "../legal-shell"

export default function ConfidentialitePage() {
  return (
    <LegalShell
      title="Politique de confidentialité"
      intro="Cette politique explique comment Schooly traite les données nécessaires au fonctionnement du service."
    >
      <h2>1. Responsable et contact</h2>
      <p>
        Schooly est exploité par <strong>Refontiq</strong>. Contact :
        refontiq@gmail.com · +225 01 00 37 29 00 · Abidjan, Côte d’Ivoire.
      </p>

      <h2>2. Données susceptibles d’être traitées</h2>
      <ul>
        <li>identité et coordonnées des utilisateurs ;</li>
        <li>informations relatives aux établissements ;</li>
        <li>données scolaires nécessaires à la gestion des élèves et des inscriptions ;</li>
        <li>données pédagogiques, administratives et financières saisies par l’établissement ;</li>
        <li>données techniques nécessaires à la sécurité, à l’authentification et au fonctionnement.</li>
      </ul>

      <h2>3. Finalités</h2>
      <p>
        Les données sont traitées notamment pour fournir Schooly, gérer les comptes et accès,
        administrer les établissements, produire les documents demandés, assurer la sécurité,
        gérer la facturation du service, effectuer les sauvegardes et répondre aux obligations
        légales applicables.
      </p>

      <h2>4. Données des élèves</h2>
      <p>
        L’établissement doit collecter et utiliser les données des élèves conformément aux règles
        qui lui sont applicables. Schooly ne doit recevoir que les données nécessaires aux finalités
        de gestion scolaire activées par l’établissement. Les données ne sont pas vendues ou louées
        à des fins publicitaires par Refontiq.
      </p>

      <h2>5. Facturation Schooly</h2>
      <p>
        Pour déterminer le montant annuel dû à Refontiq, Schooly peut comptabiliser les inscriptions
        facturables de l’établissement pour l’année scolaire concernée. Le tarif de référence est
        de <strong>1 000 FCFA par élève et par année scolaire</strong>. Cette utilisation est limitée
        à la gestion du service et de sa facturation.
      </p>

      <h2>6. Accès aux données</h2>
      <p>
        L’accès est limité aux utilisateurs autorisés par l’établissement et aux personnes ou
        prestataires techniques qui en ont besoin pour fournir, sécuriser ou maintenir le service,
        dans la mesure nécessaire et sous réserve des obligations applicables.
      </p>

      <h2>7. Sécurité</h2>
      <p>
        Refontiq met en œuvre des mesures raisonnables de sécurité : contrôle des accès, authentification,
        séparation des espaces d’établissement, chiffrement des échanges, sauvegardes et journalisation
        des opérations pertinentes. La sécurité ne peut toutefois être garantie contre tous les
        risques existants sur Internet.
      </p>

      <h2>8. Conservation</h2>
      <p>
        Les données sont conservées pendant la durée nécessaire au fonctionnement du service et aux
        obligations légales, contractuelles, comptables ou de sécurité applicables. À la fin du
        service, les modalités de restitution, d’archivage, de suppression ou d’anonymisation sont
        déterminées selon la nature des données et les obligations applicables.
      </p>

      <h2>9. Droits et demandes</h2>
      <p>
        Les personnes concernées peuvent exercer les droits prévus par la réglementation applicable,
        notamment lorsque ceux-ci sont reconnus par la loi, en contactant l’établissement pour les
        données dont il est responsable et Refontiq pour les questions relevant du fonctionnement
        de Schooly.
      </p>

      <h2>10. Sous-traitants et services tiers</h2>
      <p>
        Schooly peut dépendre de fournisseurs techniques pour l’hébergement, l’authentification,
        l’envoi de messages, les paiements ou d’autres fonctions. Refontiq sélectionne les services
        nécessaires et prend des mesures appropriées pour protéger les données traitées dans leur
        cadre.
      </p>

      <h2>11. Cookies et technologies nécessaires</h2>
      <p>
        Schooly peut utiliser des cookies ou mécanismes similaires strictement nécessaires à la
        session, à l’authentification et à la sécurité. Les technologies publicitaires ou de suivi
        non nécessaires ne doivent pas être activées sans information et base appropriées.
      </p>

      <h2>12. Évolution de la politique</h2>
      <p>
        Toute évolution substantielle est publiée avec une nouvelle version et une nouvelle date
        d’entrée en vigueur. Les informations de contact restent celles indiquées dans les mentions
        légales.
      </p>
    </LegalShell>
  )
}

/** Contract text, verbatim from the client HTML `Contrato Arrendamiento.dc.html` (numbering included). */
export const CONTRACT_TITLE = "CONTRATO DE ARRIENDO DE BIENES MUEBLES";
export const EXPONEN_TITLE = "EXPONEN";
export const CLAUSES_TITLE = "CLÁUSULAS";
export const PREAMBLE_CONTINUATION = "La parte ARRENDADORA y la parte ARRENDATARIA, que en adelante podrán ser denominadas individualmente como “la parte” y conjuntamente como “las partes”, reconociéndose capacidad legal suficiente para contratar y obligarse recíprocamente, y siendo responsable de la veracidad de sus declaraciones,";
export const EXPONEN: readonly string[] = [
  "I. Que la PARTE ARRENDADORA es propietaria del bien mueble o conjunto de bienes muebles, en adelante, \"el bien mueble\", que se individualiza en el (los) Anexo(s) del presente Contrato.",
  "II. Que el(los) bien(es) mueble(s) se encuentra(n) en perfecto estado de conservación.",
  "III. Que ambas partes conocen y aceptan las características y el estado de uso y conservación del bien mueble, de acuerdo con lo declarado. La PARTE ARRENDADORA manifiesta que ha sido informado por la otra parte al momento de este acto de firmar este Contrato, y consiente en entregar el bien mueble cumpliendo las condiciones y el propósito de formalizar el presente documento.",
  "IV. Que la PARTE ARRENDATARIA está interesada en el arrendamiento de dicho bien mueble por los usos y disfrutes, y la PARTE ARRENDADORA consiente dicha cesión.",
  "V. Y que habiendo llegado las partes a un entendimiento pleno y perfecto sobre la materia de sus voluntades, formalizan su acuerdo respecto al arrendamiento de este(os) bien(s) mueble(s), en adelante, el \"Contrato\", con el objeto de constituir y regular su acuerdo, el cual se rige por las siguientes:",
];
export type ContractBlock =
  | { kind: "p"; text: string }
  | { kind: "bullets"; items: readonly string[] };
export interface ContractClauseTemplate {
  number: string;
  title: string;
  blocks: readonly ContractBlock[];
}
export const CLAUSE_TEMPLATES: readonly ContractClauseTemplate[] = [
  {
    number: "PRIMERA",
    title: "OBJETO DEL CONTRATO",
    blocks: [
      { kind: "p", text: "LA ARRENDADORA entrega en arriendo al ARRENDATARIO, quien acepta, el (los) bien(es) mueble(s) descrito(s) en el(los) Anexo(s) de este contrato, con cuanto lo sea inherente y accesorio, el (los) cual forma(n) parte integrante del mismo." },
      { kind: "p", text: "La PARTE ARRENDATARIA declara que ha revisado suficientemente dicho(s) bien(es) mueble(s), confirmando que se encuentra(n) en perfecto estado para el uso que consistirá su destino." },
    ],
  },
  {
    number: "SEGUNDA",
    title: "USO O DESTINO",
    blocks: [
      { kind: "p", text: "La PARTE ARRENDATARIA se obliga a darle uso al bien(es) mueble(s), única y exclusivamente, en actividades relacionadas con la fotografía y producción audiovisual." },
      { kind: "p", text: "Dicho uso no podrá ser modificado por la PARTE ARRENDATARIA sin el consentimiento previo, expreso y por escrito de la PARTE ARRENDADORA." },
      { kind: "p", text: "Igualmente, la PARTE ARRENDATARIA se obliga a no realizar ningún uso o disposición del bien mueble que sea de contrariedad con lo anterior, la moral o el orden público, o bien de cualquier otro modo pueda causar lesiones o daños a terceros, personas, cosas o al propio bien mueble a su disposición." },
      { kind: "p", text: "El incumplimiento de cualquiera de estos requisitos será motivo de resolución del Contrato." },
    ],
  },
  {
    number: "TERCERA",
    title: "DURACIÓN DEL ARRIENDO",
    blocks: [
      { kind: "p", text: "El presente Contrato se entenderá firmado en aquella fecha correspondiente a la creación de la cuenta de USUARIO en el Sitio web {{website}}, sin embargo, comenzará a regir desde la fecha de la aceptación de presupuesto realizada a través de dicho sitio web, fecha que constará en el (los) Anexo(s) del presente Contrato y se extenderá por el período de que se describe en dicho Anexo(s) contado desde la fecha de entrega de los equipos. EL ARRENDATARIO deberá devolver los equipos en la fecha y hora estipuladas en el(los) Anexos, salvo que las partes acuerden por escrito una extensión del plazo." },
      { kind: "p", text: "El ARRENDATARIO deberá crearse una cuenta y un usuario a través del sitio web {{website}}, donde se encontrará identificado mediante su nombre, dirección de correo electrónico y datos necesarios para el presente Contrato, los cuales se solicitarán en el proceso de registro, quedando dicho registro como constancia fehaciente de la aceptación de los términos del presente Contrato. En los Anexos del presente Contrato constarán los presupuestos aprobados de acuerdo a la solicitud del usuario, ARRENDATARIO." },
    ],
  },
  {
    number: "CUARTA",
    title: "ENTREGA",
    blocks: [
      { kind: "p", text: "La PARTE ARRENDADORA hará entrega del bien(es) mueble(s) objeto de este Contrato, poniéndolo en poder de la PARTE ARRENDATARIA, que lo recibe, en el horario y fecha estipulada en el Anexo(s) del presente Contrato en el domicilio señalado por el ARRENDADOR. A partir de esta entrega, la PARTE ARRENDATARIA se hace cargo de las responsabilidades derivadas de su tenencia y uso, así como de su limpieza y transporte." },
    ],
  },
  {
    number: "QUINTA",
    title: "PRECIO Y FORMA DE PAGO",
    blocks: [
      { kind: "p", text: "El precio del arriendo de los bienes individualizados en (los) Anexo(s) del presente Contrato será el establecido en el Anexo correspondiente, el cual deberá ser pagado por EL ARRENDATARIO, en las condiciones que el correspondiente Anexo determine." },
      { kind: "p", text: "El ARRENDATARIO deberá pagar una reserva por el arriendo de los bienes, lo cual corresponde al {{reservePct}}% del valor total del arriendo establecido en el Anexo correspondiente, según la cotización proporcionada previamente, y aceptada por las partes. El monto restante deberá ser pagado al momento de la entrega de los bienes mediante el método de pago acordado y que consta en el Anexo." },
      { kind: "p", text: "El monto correspondiente a la reserva deberá ser pagado mediante transferencia bancaria a:" },
      { kind: "p", text: "{{bankHolder}}" },
      { kind: "p", text: "{{bankRut}}" },
      { kind: "p", text: "{{bankName}}" },
      { kind: "p", text: "{{accountType}}" },
      { kind: "p", text: "{{accountNumber}}" },
      { kind: "p", text: "{{bankEmail}}" },
      { kind: "p", text: "o a través del sistema de pago que se encuentre disponible en el sitio web {{website}}" },
      { kind: "p", text: "La reserva deberá ser abonada antes del retiro de los bienes del domicilio acordado. El pago de la reserva asegura la disponibilidad de los equipos para la fecha solicitada y se procederá a retirarlos del stock. Sin el pago de la reserva, LA ARRENDADORA no garantiza la disponibilidad de los equipos, pudiendo estos ser puestos a disposición de terceros, sin previo aviso." },
      { kind: "p", text: "El saldo restante, correspondiente al {{balancePct}}% del valor total del arriendo, deberá ser pagado en su totalidad antes o en el momento de la devolución por parte de la ARRENDATARIA de los bienes arrendados" },
      { kind: "p", text: "El incumplimiento por la PARTE ARRENDATARIA de las obligaciones de pago de la renta en el plazo fijado será motivo de resolución del presente Contrato, debiendo en tal caso restituir inmediatamente el(los) bien(s) mueble(s) a la PARTE ARRENDADORA y perdiendo el monto pagado por concepto de reserva." },
    ],
  },
  {
    number: "SEXTA",
    title: "ENTREGA Y DEVOLUCIÓN DE LOS EQUIPOS",
    blocks: [
      {
        kind: "bullets",
        items: [
          "LA ARRENDADORA entregará los equipos al ARRENDATARIO en el estado descrito en el(los) Anexo(s), previa revisión conjunta.",
          "EL ARRENDATARIO se compromete a devolver los equipos en las mismas condiciones en que fueron entregados, salvo el desgaste normal por uso.",
          "La entrega y devolución de los equipos se realizará en el domicilio señalado por el ARRENDADOR, en horario previamente acordado con éste.",
          "Los bienes y sus accesorios deben ser entregados en las mismas condiciones en que fueron entregados, considerando su correcto funcionamiento y estado de conservación, limpios y secos.",
        ],
      },
    ],
  },
  {
    number: "SÉPTIMA",
    title: "GASTOS POR USO Y REPARACIONES",
    blocks: [
      { kind: "p", text: "Los gastos inherentes a la utilización del bien mueble serán de cargo de la PARTE ARRENDATARIA." },
      { kind: "p", text: "En el caso de las reparaciones al bien mueble que deban efectuarse durante la vigencia de este Contrato, serán de cargo de la PARTE ARRANDATARIA. Dichas reparaciones deberán realizarse en servicios técnicos autorizados por las marcas de cada bien arrendado, previa coordinación y autorización del ARRENDADOR." },
      { kind: "p", text: "Sin embargo, si existe una destrucción total de la cosa, una pérdida total de utilidad o existe una destrucción de más del 50% de los equipos y/o accesorios, que conste en informe de servicio técnico autorizado, si las reparaciones imposibilitan que la PARTE ARRENDADORA pueda hacer uso del bien(es) mueble(s) para el uso que fue(ron) arrendado(s) o cuando la reparación y los costos de la misma superen el valor del bien, LA PARTE ARRENDATARIA deberá pagar al ARRENDADOR del valor total de equipo, el cual podrá realizarse a través de entrega de un bien idéntico en calidad de nuevo o a través de transferencia bancaria. Para determinar el valor del bien que deberá reintegrarse, el ARRENDADOR le entregará un presupuesto en que incluirá un desglose de cómo se ha realizado la estimación del bien." },
      { kind: "p", text: "El ARRENDATARIO deberá efectuar las reparaciones o el reemplazo del equipo dentro de un plazo máximo de 10 días hábiles. Dichas acciones no eximirán ni suspenderán el cumplimiento de las obligaciones contractuales vigentes." },
      { kind: "p", text: "En caso de ocurrir daños físicos o de operabilidad en los bienes, el ARRENDADOR tiene derecho a realizar un chequeo previo de los bienes y emitirá un informe técnico para determinar la reparación y/o reemplazo de las partes dañadas o la reposición total de los bienes." },
      { kind: "p", text: "En todo caso, la PARTE ARRENDATARIA no podrá, sin el consentimiento de la PARTE ARRENDADORA, hacer en el bien(es) mueble(s) otros trabajos o cambios que puedan turbar o disminuir el goce del bien." },
      { kind: "p", text: "En todo caso, si las reparaciones necesarias no pueden postergarse sin comprometer la seguridad del bien mueble y afectan gravemente su uso o goce, serán de responsabilidad de la PARTE ARRENDADORA, si es que son de su imputabilidad. En dicho caso, la PARTE ARRENDATARIA tendrá derecho a que se le restituyan los días de arriendo en los que no haya podido hacer uso del bien mueble debido a dichas reparaciones, ajustando el plazo y las obligaciones contractuales en consecuencia." },
      { kind: "p", text: "Las reparaciones que se deban efectuar por una utilización del bien mueble indebida o contraria a lo dispuesto en este Contrato, son de cargo de la PARTE ARRENDATARIA. Por el contrario será de cargo de la PARTE ARRENDADORA las reparaciones cuyas causas eran conocidas o no pudieron ser controladas por la PARTE ARRENDADORA antes de entregar el(los) bien(es) mueble(s) en arriendo, y no comunicadas a la PARTE ARRENDATARIA." },
      { kind: "p", text: "En relación con los elementos fungibles, tales como ampolletas, tubos de flash, fusibles y LED, si estos dejan de funcionar debido al término de su vida útil mientras estén en poder del ARRENDATARIO, la responsabilidad de este último se limitará al 50% del valor de reemplazo de dichos elementos. Por otro lado, en caso de rotura o daño atribuible al ARRENDATARIO, este será responsable del 100% del valor de reemplazo." },
    ],
  },
  {
    number: "OCTAVA",
    title: "OBLIGACIONES DE LAS PARTES",
    blocks: [
      { kind: "p", text: "Obligaciones del ARRENDADOR: La PARTE ARRENDADORA se obliga a:" },
      {
        kind: "bullets",
        items: [
          "Entregar los equipos y sus accesorios objeto del Contrato en condiciones óptimas de uso.",
          "Mantener al bien mueble en estado de servir para el fin que ha sido arrendado.",
          "Librar a la PARTE ARRENDATARIA de toda turbación o embarazo en el goce del bien mueble.",
          "Cubrir los gastos de las reparaciones al bien mueble que deban efectuarse durante la vigencia de este Contrato, cuyas causas eran conocidas o no pudieron ser controladas por la PARTE ARRENDADORA antes de entregar el(los) bien(es) mueble(s) en arriendo, y no comunicadas a la PARTE ARRENDATARIA.",
        ],
      },
      { kind: "p", text: "Obligaciones de EL ARRENDATARIO: La PARTE ARRENDATARIA se obliga a:" },
      {
        kind: "bullets",
        items: [
          "Verificar las condiciones físicas y de funcionamiento de todos los bienes que se entregan en arriendo, así como la cantidad y el modelo, ya sea el ARRENDATARIO una Empresa, Cliente directo y/o persona(s) designada(s) autorizada(s) para el retiro de los equipos. Una vez retirados los bienes y aceptada su conformidad, se entenderá que LA PARTE ARRENDATARIA no podrá alegar posteriormente respecto a la calidad ni estado de los bienes.",
          "Utilizar los equipos y accesorios exclusivamente para los fines declarados y conforme a las instrucciones proporcionadas, no pudiendo, en consecuencia, hacerlos servir a otros fines que los convenidos.",
          "Pagar oportunamente y de manera íntegra las rentas de arriendo.",
          "No subarrendar, transferir ni ceder los equipos a terceros, así como tampoco realizar cambios o mejoras al bien mueble sin consentimiento previo y escrito de la PARTE ARRENDADORA",
          "No contraer compromisos económicos o legales que puedan ver afectados los intereses del ARRENDADOR.",
          "Tomar las precauciones correspondientes para el transporte, armado y uso de cada uno de los bienes y sus accesorios. EL ARRENDATARIO debe siempre observar el cuidado en el correcto ensamblaje de partes, piezas y en el manejo apropiado de todos los bienes para conservar su funcionamiento e integridad física, so pena de indemnizar al ARRENDADOR de los daños que éste pueda causar en los bienes.",
          "Asumir la responsabilidad acerca de daños físicos y/o de operabilidad, sean hechos por causas directas o indirectas, causadas con o sin intencionalidad por personas pertenecientes a la empresa arrendadora o por terceros, en los bienes, accesorios, partes y piezas que estén en su poder.",
          "A asumir toda responsabilidad por las pérdidas, daños o perjuicios que puedan sufrir los bienes arrendados como consecuencia de caso fortuito o fuerza mayor, entendiéndose por tales los definidos en el artículo 45 del Código Civil. Esta responsabilidad incluirá, a modo enunciativo pero no limitativo, eventos tales como incendios, inundaciones, terremotos o cualquier otro suceso de naturaleza imprevisible e inevitable, salvo que dichos eventos sean ocasionados por dolo o negligencia del ARRENDATARIO. En caso de que ocurra un evento de caso fortuito o fuerza mayor, el ARRENDATARIO se compromete a reparar, reponer o indemnizar los bienes afectados dentro de un plazo no superior a 30 días hábiles, de conformidad con el avalúo realizado por el ARRENDADOR, que será aceptada por ambas partes.",
          "Restituir inmediatamente al bien mueble una vez terminado el presente Contrato, poniéndolo a disposición de la PARTE ARRENDADORA en los términos previamente estipulados.",
          "Notificar de inmediato a LA PARTE ARRENDADORA en caso de pérdida, daño o cualquier inconveniente que afecte a los equipos.",
          "Reparar los daños, gastos, pérdidas u otras lesiones que el uso del bien mueble haya ocasionado por descuido o culpa suya.",
          "Devolver los bienes y sus accesorios en las mismas condiciones en que fueron entregados, considerando su estado de funcionamiento, de conservación y limpieza.",
        ],
      },
      { kind: "p", text: "Para efectos legales, las partes acuerdan elevar las obligaciones de la PARTE ARRENDATARIA a la calidad de esenciales, dejando explícita la facultad de la PARTE ARRENDADORA de invocar una infracción grave del Contrato y derecho de la PARTE ARRENDADORA a ponerle término al mismo." },
    ],
  },
  {
    number: "NOVENA",
    title: "GARANTÍAS Y MULTAS POR RETRASO EN LA ENTREGA DE LOS BIENES Y POR SU MAL ESTADO",
    blocks: [
      { kind: "p", text: "No se exigirá una garantía monetaria debido a que el Contrato formaliza el compromiso entre las partes. No obstante, EL ARRENDATARIO responderá por los daños o pérdidas que puedan sufrir los equipos durante el periodo de arriendo." },
      { kind: "p", text: "EL ARRENDATARIO debe devolver los bienes en el domicilio señalado por el ARRENDADOR en el horario señalado en el Anexo. En caso de incumplimiento de dicho plazo, se aplicará una multa equivalente al valor de un día de arriendo por cada día de retraso en la devolución de los bienes, sin perjuicio de las demás acciones legales que pudiera ejercer LA ARRENDADORA." },
      { kind: "p", text: "El ARRENDATARIO podrá notificar al ARRENDADOR, a través de correo electrónico, u otro medio idóneo, con al menos 48 horas de antelación a la fecha programada para el retiro de los bienes, indicada en el Anexo correspondiente, su decisión de desistir del arrendamiento. Dicha notificación deberá realizarse de manera expresa y textual, señalando que renuncia al arriendo de los bienes. En este caso, el monto pagado en concepto de reserva no será reembolsado." },
      { kind: "p", text: "EL ARRENDATARIO se obliga a devolver los equipos y sus accesorios en las mismas condiciones en que fueron entregados, considerando su correcto funcionamiento y estado de conservación, salvo el desgaste normal por uso. Asimismo, los equipos deberán ser devueltos limpios y secos. En caso de que los bienes presenten suciedad, acumulación de polvo o humedad, LA ARRENDADORA procederá a una inspección técnica para evaluar posibles daños. Si se determina que el ingreso de polvo, agua u otros elementos ha afectado la operatividad de los equipos, EL ARRENDATARIO será responsable de los costos de limpieza especializada, reparación o, en caso de daño irreparable, de su reposición conforme al valor que determine el ARRENDATARIO conforme a informe técnico." },
    ],
  },
  {
    number: "DÉCIMA",
    title: "RESPONSABILIDAD",
    blocks: [
      { kind: "p", text: "A partir del momento en que el ARRENDATARIO retire los bienes del lugar designado por el ARRENDADOR para su entrega, el ARRENDATARIO asumirá plena responsabilidad por la custodia, transporte, uso y conservación de los mismos y de sus accesorios." },
      { kind: "p", text: "El ARRENDATARIO será responsable de cualquier daño, pérdida, deterioro o destrucción que sufran los equipos, incluyendo aquellos ocurridos durante el transporte, salvo que dichos daños sean consecuencia directa de defectos preexistentes en los equipos que puedan ser acreditados de manera fehaciente." },
      { kind: "p", text: "El ARRENDATARIO deberá tomar todas las precauciones necesarias para garantizar la adecuada protección y seguridad de los equipos desde el momento de su retiro hasta su devolución al ARRENDADOR." },
      { kind: "p", text: "La PARTE ARRENDATARIA se hace directa y exclusivamente responsable, eximiendo de toda responsabilidad a la PARTE ARRENDADORA, de todos los daños que pueda causar a sí misma, a terceras personas o a las cosas haciendo uso del bien mueble arrendado, personalmente o por aquellas personas que ella autorice a utilizar." },
      { kind: "p", text: "La PARTE ARRENDADORA no responde por daños causados al equipo por negligencia o mal uso de la PARTE ARRENDATARIA o por daños producidos por situaciones imprevistas de responsabilidad de terceros. En cualquiera de estos casos la ARRENDADORA cobrará al ARRENDATARIO los gastos en que deba incurrir para su reparación." },
    ],
  },
  {
    number: "DÉCIMO PRIMERA",
    title: "MODIFICACIONES AL CONTRATO",
    blocks: [
      { kind: "p", text: "LA ARRENDADORA se reserva el derecho de modificar los términos y condiciones del presente Contrato cuando ello sea necesario para la adecuada prestación del servicio, el cumplimiento de normativas legales o la actualización de sus políticas operativas." },
      { kind: "p", text: "Toda modificación será debidamente notificada a EL ARRENDATARIO a través de la plataforma {{website}} y/o mediante correo electrónico registrado en su cuenta de usuario. Dichas modificaciones entrarán en vigor a partir de la fecha indicada en la notificación, y EL ARRENDADOR deberá aceptarlas expresamente para continuar utilizando el servicio." },
      { kind: "p", text: "En caso de que EL ARRENDATARIO no acepte las modificaciones, podrá solicitar la terminación del Contrato sin penalización, siempre que no existan obligaciones pendientes derivadas del uso de los bienes arrendados." },
    ],
  },
  {
    number: "DÉCIMO SEGUNDA",
    title: "RESOLUCIÓN DEL CONTRATO",
    blocks: [
      { kind: "p", text: "El presente Contrato podrá ser resuelto por el mutuo acuerdo de las partes, con los efectos que ellas determinen." },
      { kind: "p", text: "Sin perjuicio de lo anterior, el incumplimiento de las obligaciones legales o contractuales dará derecho a la otra parte a resolver el Contrato sin previo aviso, aunque deberá notificar a la otra parte las causas de extinción." },
      { kind: "p", text: "EL ARRENDATARIO reconoce y acepta que el presente Contrato se formaliza de manera digital a través de su cuenta de usuario en el sitio web {{website}}. En consecuencia, en caso de incumplimiento de cualquiera de las obligaciones establecidas en este Contrato, particularmente aquellas relacionadas con el pago de los arriendos o cualquier otra falta grave a los términos acordados, LA ARRENDADORA podrá, a su sola discreción, resolver el Contrato de manera inmediata y proceder a la eliminación de la cuenta de usuario del ARRENDATARIO en la plataforma, sin que ello genere derecho a reembolso o compensación alguna." },
      { kind: "p", text: "Dicha eliminación no eximirá al ARRENDATARIO de sus obligaciones pendientes, incluyendo el pago de sumas adeudadas o la devolución de los bienes arrendados." },
      { kind: "p", text: "En caso de que cualquiera de las partes incumpla alguna de las obligaciones establecidas en este Contrato, o las cumpla de manera defectuosa, la otra parte tendrá derecho a solicitar la resolución del mismo. Sin embargo, antes de proceder a la terminación, se deberá conceder un plazo razonable para que la parte incumplidora subsane dicho incumplimiento. Si el incumplimiento resulta grave o excede los límites establecidos en las disposiciones formales del Contrato, la parte afectada podrá optar directamente por la resolución del Contrato, notificando dicha decisión por correo electrónico u otro medio idóneo." },
      { kind: "p", text: "Se siga por exigir así el cumplimiento o la exclusión del Contrato, a la parte optante, además, tendrá derecho a ser indemnizada por los perjuicios que sean razonablemente justificados." },
      { kind: "p", text: "En caso de que la parte afectada decida no resolver el Contrato, no se considerará como una renuncia a su derecho, y podrá ejercer tal facultad en cualquier momento del Contrato, incluso si las formas ajenas sus derechos para hacer cumplir sus obligaciones derivadas del presente Contrato." },
    ],
  },
  {
    number: "DÉCIMO TERCERA",
    title: "TERMINACIÓN ANTICIPADA DEL CONTRATO",
    blocks: [
      { kind: "p", text: "El presente Contrato podrá darse por terminado de forma anticipada en los siguientes casos:" },
      {
        kind: "bullets",
        items: [
          "Por mutuo acuerdo de las partes.",
          "Por incumplimiento de cualquiera de las obligaciones establecidas en este Contrato.",
          "Por la devolución anticipada de los equipos, previa notificación por escrito a LA ARRENDADORA.",
        ],
      },
    ],
  },
  {
    number: "DÉCIMO CUARTA",
    title: "NOTIFICACIONES",
    blocks: [
      { kind: "p", text: "Para realizar cualquier notificación entre las partes que tenga como origen el presente Contrato, éstas acuerdan que su domicilio para estos efectos serán las direcciones indicadas al principio de este Contrato. A falta de una designación expresa, se tendrá por válida aquella dirección que figure como domicilio principal de cada parte y en su defecto el domicilio señalado para efectos de este Contrato en el registro correspondiente." },
      { kind: "p", text: "Asimismo, ambas partes declaran que están de acuerdo en que las notificaciones puedan ser realizadas mediante medios electrónicos, siempre que exista constancia de recepción." },
      { kind: "p", text: "Cuando se opte por un medio electrónico, la parte que remite la comunicación deberá guardar el acuse de recibo por correo electrónico o una impresión de la notificación enviada y de su respuesta, según lo que se establezca." },
      { kind: "p", text: "Para garantizar la autenticidad de las personas emisoras, la parte destinataria de una notificación tiene el derecho de mantener una comunicación fluida entre las partes, facilitando las siguientes direcciones de correo electrónico:" },
      { kind: "p", text: "PARTE ARRENDADORA: {{landlordEmail}}" },
      { kind: "p", text: "PARTE ARRENDATARIA: {{tenantEmail}}" },
    ],
  },
  {
    number: "DÉCIMO QUINTA",
    title: "PROPIEDAD INDUSTRIAL E INTELECTUAL",
    blocks: [
      { kind: "p", text: "Las partes reconocen y acuerdan que toda propiedad intelectual e industrial, incluyendo, pero sin limitarse a nombres comerciales, logotipos y marcas registradas, es de exclusiva propiedad de cada una de ellas. En virtud del presente contrato, ninguna de las partes podrá utilizar la propiedad intelectual o industrial de la otra en anuncios, materiales promocionales o cualquier otro medio sin la autorización previa y expresa por escrito de su titular." },
      { kind: "p", text: "Asimismo, EL ARRENDATARIO reconoce y acepta que ni él ni ningún tercero adquieren derechos de propiedad sobre los bienes objeto de este contrato, ni sobre cualquier servicio asociado a estos. Esto incluye, sin limitación, cualquier desarrollo, mejora, modificación o material provisto o generado en relación con los bienes arrendados, los cuales seguirán siendo de exclusiva propiedad de LA ARRENDADORA." },
    ],
  },
  {
    number: "DÉCIMO SEXTA",
    title: "DOMICILIO Y LEGISLACIÓN APLICABLE",
    blocks: [
      { kind: "p", text: "Para todos los efectos legales derivados del presente Contrato, las partes fijan domicilio en la ciudad de Santiago, y se someten a la jurisdicción de sus tribunales de justicia, conforme a la legislación vigente en la República de Chile." },
    ],
  },
  {
    number: "DÉCIMO SÉPTIMA",
    title: "DECLARACIONES FINALES",
    blocks: [
      { kind: "p", text: "Las partes declaran que han leído y comprendido la totalidad del presente Contrato, firmando en señal de conformidad. Este documento se firma en dos ejemplares de igual tenor, fecha y efecto, quedando uno en poder de cada parte." },
      { kind: "p", text: "Se faculta al portador de uno de los ejemplares originales del presente Contrato para requerir las anotaciones, inscripciones y subscripciones que procedan o sean pertinentes." },
    ],
  },
];

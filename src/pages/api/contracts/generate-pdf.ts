import type { APIRoute } from 'astro';

/**
 * Internal Contract PDF Generation API
 * This API generates contract PDFs using astro-pdf
 * Called by external API and internal services
 */

// Email template generation function
interface ContractEmailData {
  user_id?: number;
  nombre?: string;
  apellido?: string;
  email?: string;
  rut?: string;
  telefono?: string;
  tipo_cliente?: string;
  empresa_nombre?: string;
  contractUrl?: string;
}

const generateContractEmailHTML = (data: ContractEmailData): string => {
  const customerName = `${data.nombre || ''} ${data.apellido || ''}`.trim();
  
  return `
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head>
<!--[if gte mso 15]>
<xml>
<o:OfficeDocumentSettings>
<o:AllowPNG/>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
<![endif]-->
<meta charset="UTF-8"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>*|MC:SUBJECT|*</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin=""/>
<!--[if !mso]><!--><link rel="stylesheet" type="text/css" id="newGoogleFontsStatic" href="https://fonts.googleapis.com/css?family=Source+Code+Pro:400,400i,700,700i,900,900i"/><!--<![endif]--><style>img{-ms-interpolation-mode:bicubic;}
table, td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
.mceStandardButton, .mceStandardButton td, .mceStandardButton td a{mso-hide:all!important;}
p, a, li, td, blockquote{mso-line-height-rule:exactly;}
p, a, li, td, body, table, blockquote{-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;}
.mcnPreviewText{display:none!important;}
.bodyCell{margin:0 auto;padding:0;width:100%;}
.ExternalClass, .ExternalClass p, .ExternalClass td, .ExternalClass div, .ExternalClass span, .ExternalClass font{line-height:100%;}
.ReadMsgBody, .ExternalClass{width:100%;}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important;}
body{height:100%;margin:0;padding:0;width:100%;background:#ffffff;}
p{margin:0;padding:0;}
table{border-collapse:collapse;}
td, p, a{word-break:break-word;}
h1, h2, h3, h4, h5, h6{display:block;margin:0;padding:0;}
img, a img{border:0;height:auto;outline:none;text-decoration:none;}
a[href^="tel"], a[href^="sms"]{color:inherit;cursor:default;text-decoration:none;}
.mceColumn .mceButtonLink,
                  .mceColumn-1 .mceButtonLink, 
                  .mceColumn-2 .mceButtonLink, 
                  .mceColumn-3 .mceButtonLink,
                  .mceColumn-4 .mceButtonLink{min-width:30px;}
div[contenteditable="true"]{outline:0;}
.mceImageBorder{display:inline-block;}
.mceImageBorder img{border:0!important;}
body, #bodyTable{background-color:rgb(235, 235, 235);}
.mceText, .mcnTextContent, .mceLabel{font-family:"Source Code Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;}
.mceText, .mcnTextContent, .mceLabel{color:rgb(255, 255, 255);}
.mceText p, .mceText label, .mceText input{margin-bottom:0;}
.mceSpacing-12 .mceInput + .mceErrorMessage{margin-top:-6px;}
.mceSpacing-24 .mceInput + .mceErrorMessage{margin-top:-12px;}
.mceInput{background-color:transparent;border:2px solid rgb(208, 208, 208);width:60%;color:rgb(77, 77, 77);display:block;}
.mceInput[type="radio"], .mceInput[type="checkbox"]{float:left;margin-right:12px;display:inline;width:auto!important;}
.mceLabel > .mceInput{margin-bottom:0;margin-top:2px;}
.mceLabel{display:block;}
.mceText p, .mcnTextContent p{color:rgb(255, 255, 255);font-family:"Source Code Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;font-size:16px;font-weight:normal;line-height:1.5;mso-line-height-alt:150%;text-align:center;letter-spacing:0;direction:ltr;margin:0;}
.mceText a, .mcnTextContent a{color:rgb(0, 0, 0);font-style:normal;font-weight:normal;text-decoration:underline;direction:ltr;}
p.mcePastedContent, h1.mcePastedContent, h2.mcePastedContent, h3.mcePastedContent, h4.mcePastedContent{text-align:left;}
#d13 p, #d13 h1, #d13 h2, #d13 h3, #d13 h4, #d13 ul{text-align:center;}
@media only screen and (max-width: 480px) {
body, table, td, p, a, li, blockquote{-webkit-text-size-adjust:none!important;}
body{width:100%!important;min-width:100%!important;}
body.mobile-native{-webkit-user-select:none;user-select:none;transition:transform 0.2s ease-in;transform-origin:top center;}
colgroup{display:none;}
.mceLogo img, .mceImage img, .mceSocialFollowIcon img{height:auto!important;}
.mceWidthContainer{max-width:660px!important;}
.mceColumn, .mceColumn-2{display:block!important;width:100%!important;}
.mceColumn-forceSpan{display:table-cell!important;width:auto!important;}
.mceColumn-forceSpan .mceButton a{min-width:0!important;}
.mceReverseStack{display:table;width:100%;}
.mceColumn-1{display:table-footer-group;width:100%!important;}
.mceColumn-3{display:table-header-group;width:100%!important;}
.mceColumn-4{display:table-caption;width:100%!important;}
.mceKeepColumns .mceButtonLink{min-width:0;}
.mceBlockContainer, .mceSpacing-24{padding-right:16px!important;padding-left:16px!important;}
.mceBlockContainerE2E{padding-right:0;padding-left:0;}
.mceImage, .mceLogo{width:100%!important;height:auto!important;}
.mceText img{max-width:100%!important;}
.mceFooterSection .mceText, .mceFooterSection .mceText p{font-size:16px!important;line-height:140%!important;}
.mceText p{margin:0;font-size:16px!important;line-height:1.5!important;mso-line-height-alt:150%;}
.bodyCell{padding-left:16px!important;padding-right:16px!important;}
.mceButtonContainer{width:fit-content!important;max-width:fit-content!important;}
.mceButtonLink{padding:18px 28px!important;font-size:16px!important;}
.mceDividerContainer{width:100%!important;}
#b13 .mceTextBlockContainer{padding:12px 16px!important;}
#gutterContainerId-13, #gutterContainerId-22, #gutterContainerId-25{padding:0!important;}
#b19 .mceDividerBlock, #b21 .mceDividerBlock, #b23 .mceDividerBlock, #b29 .mceDividerBlock{border-top-width:1px!important;}
#b19, #b21, #b23, #b29{padding:25px!important;}
#b20, #b22 .mceTextBlockContainer, #b25 .mceTextBlockContainer{padding:12px 24px!important;}
#b20 table{margin-right:auto!important;float:none!important;}
#b24 table{float:none!important;margin:0 auto!important;}
#b24{padding:12px!important;}
#b24 .mceButtonLink{padding-top:16px!important;padding-bottom:16px!important;font-size:16px!important;}
}
@media only screen and (max-width: 640px) {
.mceClusterLayout td{padding:4px!important;}
}</style></head>
<body>
<!--*|IF:MC_PREVIEW_TEXT|*-->
<!--[if !gte mso 9]><!----><span class="mcnPreviewText" style="display:none; font-size:0px; line-height:0px; max-height:0px; max-width:0px; opacity:0; overflow:hidden; visibility:hidden; mso-hide:all;">Tu cuenta ha sido creada con éxito. A partir de ahora, puedes explorar y reservar el equipo fotográfico que necesites para tus proyectos. Estamos disponibles los 7 días de la semana con horario extendido 8:00 a 20:00 hrs, para ser tu aliado en cada producción.</span><!--<![endif]-->
<!--*|END:IF|*-->
<div style="display: none; max-height: 0px; overflow: hidden;">͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌    ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­</div><!--MCE_TRACKING_PIXEL-->
<center>
<table border="0" cellpadding="0" cellspacing="0" height="100%" width="100%" id="bodyTable" style="background-color: rgb(235, 235, 235);">
<tbody><tr>
<td class="bodyCell" align="center" valign="top">
<table id="root" border="0" cellpadding="0" cellspacing="0" width="100%"><tbody data-block-id="4" class="mceWrapper"><tr><td style="background-color:transparent" valign="top" align="center" class="mceSectionHeader"><!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="660" style="width:660px;"><tr><td><![endif]--><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation"><tbody><tr><td style="background-color:#ffffff" valign="top" class="mceWrapperInner"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="3"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId--7" data-block-id="-7" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="background-color:transparent;padding-top:25px;padding-bottom:25px;padding-right:25px;padding-left:25px;border:0;border-radius:0" valign="top" class="mceDividerBlockContainer" id="b19"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:transparent;width:100%" role="presentation" class="mceDividerContainer" data-block-id="19"><tbody><tr><td style="min-width:100%;border-top-width:1px;border-top-style:solid;border-top-color:#000000;line-height:0;font-size:0" valign="top" class="mceDividerBlock"> </td></tr></tbody></table></td></tr><tr><td style="background-color:transparent;padding-top:12px;padding-bottom:12px;padding-right:24px;padding-left:24px;border:0;border-radius:0" valign="top" class="mceImageBlockContainer" align="left" id="b20"><div><!--[if !mso]><!--></div><a href="https://rental.mariohans.cl" style="display:block" target="_blank" data-block-id="20"><table align="left" border="0" cellpadding="0" cellspacing="0" width="50%" style="border-collapse:separate;margin:0;vertical-align:top;max-width:50%;width:50%;height:auto" role="presentation" data-testid="image-20"><tbody><tr><td style="border:0;border-radius:0;margin:0" valign="top"><img alt="" src="https://mcusercontent.com/9ba4e87550786c74a0e5dc97e/images/278831e7-ddd7-35c3-7257-2f7860e6668d.png" width="306" height="auto" style="display:block;max-width:100%;height:auto;border-radius:0" class="imageDropZone mceLogo"/></td></tr></tbody></table></a><div><!--<![endif]--></div><div>
<!--[if mso]>
<a href="https://rental.mariohans.cl"><span class="mceImageBorder" style="border:0;border-width:2px;vertical-align:top;margin:0"><img role="presentation" class="imageDropZone mceLogo" src="https://mcusercontent.com/9ba4e87550786c74a0e5dc97e/images/278831e7-ddd7-35c3-7257-2f7860e6668d.png" alt="" width="306" height="auto" style="display:block;max-width:306px;width:306px;height:auto"/></span></a>
<![endif]-->
</div></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td></tr></tbody><tbody data-block-id="11" class="mceWrapper"><tr><td style="background-color:transparent" valign="top" align="center" class="mceSectionBody"><!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="660" style="width:660px;"><tr><td><![endif]--><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation"><tbody><tr><td style="background-color:#ffffff" valign="top" class="mceWrapperInner"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="10"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId--8" data-block-id="-8" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="background-color:transparent;padding-top:25px;padding-bottom:25px;padding-right:25px;padding-left:25px;border:0;border-radius:0" valign="top" class="mceDividerBlockContainer" id="b21"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:transparent;width:100%" role="presentation" class="mceDividerContainer" data-block-id="21"><tbody><tr><td style="min-width:100%;border-top-width:1px;border-top-style:solid;border-top-color:#000000;line-height:0;font-size:0" valign="top" class="mceDividerBlock"> </td></tr></tbody></table></td></tr><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0" valign="top" class="mceGutterContainer" id="gutterContainerId-25"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" id="b25"><table width="100%" style="border:0;background-color:transparent;border-radius:0;border-collapse:separate"><tbody><tr><td style="padding-left:24px;padding-right:24px;padding-top:12px;padding-bottom:12px" class="mceTextBlockContainer"><div data-block-id="25" class="mceText" id="d25" style="width:100%"><p style="text-align: left;" class="last-child"><span style="color:#000000;"><span style="font-size: 15px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">  ¡Tu contrato en Mario Hans Rental ha sido creada!</span></span></span></span></p></div></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="background-color:transparent;padding-top:25px;padding-bottom:25px;padding-right:25px;padding-left:25px;border:0;border-radius:0" valign="top" class="mceDividerBlockContainer" id="b23"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:transparent;width:100%" role="presentation" class="mceDividerContainer" data-block-id="23"><tbody><tr><td style="min-width:100%;border-top-width:1px;border-top-style:solid;border-top-color:#000000;line-height:0;font-size:0" valign="top" class="mceDividerBlock"> </td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td></tr></tbody><tbody data-block-id="17" class="mceWrapper"><tr><td style="background-color:transparent" valign="top" align="center" class="mceSectionFooter"><!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="660" style="width:660px;"><tr><td><![endif]--><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation"><tbody><tr><td style="background-color:#ffffff" valign="top" class="mceWrapperInner"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="16"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId--9" data-block-id="-9" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0" valign="top" class="mceGutterContainer" id="gutterContainerId-22"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" id="b22"><table width="100%" style="border:0;background-color:transparent;border-radius:0;border-collapse:separate"><tbody><tr><td style="padding-left:24px;padding-right:24px;padding-top:12px;padding-bottom:12px" class="mceTextBlockContainer"><div data-block-id="22" class="mceText" id="d22" style="width:100%"><p class="" style="font-variant-caps: normal; font-weight: 400; letter-spacing: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: auto; word-spacing: 0px; -webkit-text-stroke-width: 0px; text-decoration: none; caret-color: rgb(0, 0, 0);"><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px">Hola ${customerName},</span></span></p><p class="" style="font-variant-caps: normal; font-weight: 400; letter-spacing: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: auto; word-spacing: 0px; -webkit-text-stroke-width: 0px; text-decoration: none; caret-color: rgb(0, 0, 0);"><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px">Tu cuenta ha sido creada con éxito. A partir de ahora, puedes explorar y reservar el equipo fotográfico que necesites para tus proyectos. Estamos disponibles los </span></span><strong><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px">7 días de la semana con horario extendido 8:00 a 20:00 hrs</span></span></strong><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px">, para ser tu aliado en cada producción.</span></span></p><p class="" style="font-variant-caps: normal; font-weight: 400; letter-spacing: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: auto; word-spacing: 0px; -webkit-text-stroke-width: 0px; text-decoration: none; caret-color: rgb(0, 0, 0);"><br/></p><p class="" style="font-variant-caps: normal; font-weight: 400; letter-spacing: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: auto; word-spacing: 0px; -webkit-text-stroke-width: 0px; text-decoration: none; caret-color: rgb(0, 0, 0);"><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px">📄 </span></span><strong><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px">Información importante</span></span></strong><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px"><br/>Adjunto encontrarás el contrato con los </span></span><strong><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px">términos y condiciones de arriendo</span></span></strong><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px">, junto con toda la información legal necesaria. Te recomendamos revisarlo con detalle antes de realizar tu primer arriendo.</span></span></p><p class="" style="font-variant-caps: normal; font-weight: 400; letter-spacing: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: auto; word-spacing: 0px; -webkit-text-stroke-width: 0px; text-decoration: none; caret-color: rgb(0, 0, 0);"><br/></p><p class="" style="font-variant-caps: normal; font-weight: 400; letter-spacing: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: auto; word-spacing: 0px; -webkit-text-stroke-width: 0px; text-decoration: none; caret-color: rgb(0, 0, 0);"><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px">Si tienes cualquier duda, aquí estamos para ayudarte.</span></span></p><p class="" style="font-variant-caps: normal; font-weight: 400; letter-spacing: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: auto; word-spacing: 0px; -webkit-text-stroke-width: 0px; text-decoration: none; caret-color: rgb(0, 0, 0);"><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px">Saludos,</span></span></p><p class="" style="font-variant-caps: normal; font-weight: 400; letter-spacing: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: auto; word-spacing: 0px; -webkit-text-stroke-width: 0px; text-decoration: none; caret-color: rgb(0, 0, 0);"><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px"><br/></span></span><strong><span style="color:rgb(0, 0, 0);"><span style="font-size: 13px">Mario Hans FotoRental</span></span></strong></p><p class="mcePastedContent last-child" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><br/></p></div></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="background-color:transparent;padding-top:12px;padding-bottom:12px;padding-right:12px;padding-left:12px;border:0;border-radius:0" valign="top" class="mceButtonBlockContainer" align="center" id="b24"><div><!--[if !mso]><!--></div><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" data-block-id="24" class="mceButtonContainer"><tbody><tr class="mceStandardButton"><td style="background-color:#000000;border-radius:15px;text-align:center" valign="top" class="mceButton"><a href="" target="_blank" class="mceButtonLink" style="background-color:#000000;border-radius:15px;border:2px none #000000;color:#ffffff;display:block;font-family:'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;font-weight:normal;font-style:normal;padding:16px 28px;text-decoration:none;text-align:center;direction:ltr;letter-spacing:0px" rel="noreferrer">Descarga tu contrato.</a></td></tr></tbody></table><div><!--<![endif]--></div><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" data-block-id="24" class="mceButtonContainer"><tbody><tr>
<!--[if mso]>
<td align="center">
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
xmlns:w="urn:schemas-microsoft-com:office:word"
href="${data.contractUrl}"
style="v-text-anchor:middle; width:257.61px; height:52px;"
arcsize="6%"
strokecolor="#000000"
strokeweight="1px"
fillcolor="#000000">
<v:stroke dashstyle="solid"/>
<w:anchorlock />
<center style="
color: #ffffff;
display: block;
font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif;
font-size: 16;
font-style: normal;
font-weight: normal;
letter-spacing: 0px;
text-decoration: none;
text-align: center;
direction: ltr;"
>
Descarga tu contrato.
</center>
</v:roundrect>
</td>
<![endif]-->
</tr></tbody></table></td></tr><tr><td style="padding-top:12px;padding-bottom:12px;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" class="mceLayoutContainer" id="b27"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="27"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="24" width="100%" role="presentation"><tbody><tr><td valign="top" class="mceColumn" id="mceColumnId--6" data-block-id="-6" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="border:0;border-radius:0" valign="top" class="mceSocialFollowBlockContainer" id="b-5"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" class="mceSocialFollowBlock" data-block-id="-5"><tbody><tr><td valign="middle" align="center"><!--[if mso]><table align="left" border="0" cellspacing= "0" cellpadding="0"><tr><![endif]--><!--[if mso]><td align="center" valign="top"><![endif]--><table align="left" border="0" cellpadding="0" cellspacing="0" style="display:inline;float:left" role="presentation"><tbody><tr><td style="padding-top:3px;padding-bottom:3px;padding-left:12px;padding-right:12px" valign="top" class="mceSocialFollowIcon" align="center" width="24"><a href="https://instagram.com/mariohans" target="_blank" rel="noreferrer"><img class="mceSocialFollowImage" width="24" height="24" alt="Icono de Instagram" src="https://cdn-images.mailchimp.com/icons/social-block-v2/dark-instagram-48.png"/></a></td></tr></tbody></table><!--[if mso]></td><![endif]--><!--[if mso]><td align="center" valign="top"><![endif]--><table align="left" border="0" cellpadding="0" cellspacing="0" style="display:inline;float:left" role="presentation"><tbody><tr><td style="padding-top:3px;padding-bottom:3px;padding-left:12px;padding-right:12px" valign="top" class="mceSocialFollowIcon" align="center" width="24"><a href="https://web.whatsapp.com/send/?phone=5690818976" target="_blank" rel="noreferrer"><img class="mceSocialFollowImage" width="24" height="24" alt="Website icon" src="https://cdn-images.mailchimp.com/icons/social-block-v2/dark-link-48.png"/></a></td></tr></tbody></table><!--[if mso]></td><![endif]--><!--[if mso]></tr></table><![endif]--></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="background-color:transparent;padding-top:25px;padding-bottom:25px;padding-right:25px;padding-left:25px;border:0;border-radius:0" valign="top" class="mceDividerBlockContainer" id="b29"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:transparent;width:100%" role="presentation" class="mceDividerContainer" data-block-id="29"><tbody><tr><td style="min-width:100%;border-top-width:1px;border-top-style:solid;border-top-color:#000000;line-height:0;font-size:0" valign="top" class="mceDividerBlock"> </td></tr></tbody></table></td></tr><tr>
    </tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="border:0;border-radius:0" valign="top" class="mceLayoutContainer" align="center" id="b-2"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="-2"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td valign="top" class="mceColumn" id="mceColumnId--10" data-block-id="-10" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="border:0;border-radius:0" valign="top" align="center" id="b14"><div>
</div></td></tr></tbody></table></td>
</tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td></tr></tbody></table>
</td>
</tr>
</tbody></table>
</center>
<script type="text/javascript"  src="/6_u7pQA2/Omr9aMG/XUvxDLm/NW/iuL9cpk4JhpJrt/EhZlAQ/cDAdQR/RLRDc"></script></body></html>

  `;
};
export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('📄 Internal contract PDF generation API called');
    
    // Parse request body
    const requestData = await request.json();
    const { userData, uploadToR2 = true } = requestData;
    // ALWAYS send email when generating contracts
    const sendEmail = true;
    
    console.log('📋 Contract generation request:', {
      user_id: userData?.user_id,
      email: userData?.email,
      nombre: userData?.nombre,
      uploadToR2,
      sendEmail: sendEmail,
      note: 'Email sending is ALWAYS enabled for contracts'
    });

    // Validate required parameters
    if (!userData || !userData.user_id || !userData.email) {
      return new Response(JSON.stringify({
        success: false,
        message: 'userData con user_id y email son requeridos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const user_id = userData.user_id;

    console.log('📄 Generating contract PDF with provided user data...');
    
    // Generate PDF using HTML template + Puppeteer service (same as budget-pdf)
    console.log('📄 Making internal request to contract-pdf page with POST data...');
    
    const requestUrl = request.url;
    if (!requestUrl) {
      throw new Error('Request URL is undefined');
    }
    const baseUrl = new URL(requestUrl).origin;
    const htmlUrl = `${baseUrl}/contract-pdf/${user_id}`;
    
    console.log('🔗 HTML URL:', htmlUrl);
    console.log('📋 Sending userData to template:', {
      nombre: userData.nombre,
      apellido: userData.apellido,
      rut: userData.rut,
      email: userData.email,
      tipo_cliente: userData.tipo_cliente
    });
    
    // Get HTML content with userData via POST
    const htmlResponse = await fetch(htmlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Request': 'true',
        'Accept': 'text/html'
      },
      body: JSON.stringify({ userData })
    });

    if (!htmlResponse.ok) {
      console.error('❌ Failed to get HTML:', htmlResponse.status, htmlResponse.statusText);
      const errorText = await htmlResponse.text();
      console.error('Error details:', errorText);
      
      return new Response(JSON.stringify({
        success: false,
        message: 'Error al obtener HTML',
        error: `HTML generation failed: ${htmlResponse.status} ${htmlResponse.statusText}`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const htmlContent = await htmlResponse.text();
    console.log('✅ HTML template loaded successfully, size:', htmlContent.length, 'characters');

    // Generate PDF using Puppeteer service
    console.log('🔄 Generating PDF with Puppeteer service...');
    
    const { generatePdfFromHtml } = await import('../../../lib/pdfService');
    
    const pdfBuffer = await generatePdfFromHtml({
      htmlContent,
      format: 'A4',
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      printBackground: true
    });
    
    console.log('✅ Contract PDF generated successfully, size:', pdfBuffer.byteLength, 'bytes');

    let contractUrl: string | null = null;

    // Upload to R2 if requested
    if (uploadToR2) {
      console.log('☁️ Uploading contract PDF to Cloudflare R2...');
      
      try {
        // Upload to Cloudflare R2 via worker
        const workerUrl = import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL || 'https://workers.mariohans.cl';
        console.log('☁️ Using Cloudflare Worker URL:', workerUrl);
        
        if (!workerUrl) {
          throw new Error('CLOUDFLARE_WORKER_URL not configured');
        }

        const timestamp = Date.now();
        const filename = `contract_${user_id}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}_${timestamp}.pdf`;
        
        const formData = new FormData();
        formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), filename);
        formData.append('documentType', 'contract');
        formData.append('userId', String(user_id));

        const uploadResponse = await fetch(`${workerUrl}/upload-file-only`, {
          method: 'POST',
          body: formData
        });

        console.log('📤 Upload response status:', uploadResponse.status);
        
        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          contractUrl = uploadResult.url;
          console.log('✅ Contract PDF uploaded to R2:', contractUrl);
          console.log('📊 Upload result details:', uploadResult);
        } else {
          const errorText = await uploadResponse.text();
          console.error('❌ Failed to upload to R2:', uploadResponse.status, errorText);
          // Don't throw error, just continue without URL
          console.log('⚠️ Continuing without R2 upload...');
        }
      } catch (uploadError) {
        console.error('❌ Upload to R2 failed:', uploadError);
        // Continue without upload - we still have the PDF
      }
    }

    // Update user profile with contract URL and all user data
    if (contractUrl) {
      console.log('💾 Updating user profile with contract URL and user data...');
      
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          import.meta.env.PUBLIC_SUPABASE_URL!,
          import.meta.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Prepare update data - include all fields from userData
        const updateData: any = {
          url_user_contrato: contractUrl,
          updated_at: new Date().toISOString()
        };

        // Add all user profile fields if they exist in userData
        if (userData.nombre) updateData.nombre = userData.nombre;
        if (userData.apellido) updateData.apellido = userData.apellido;
        if (userData.email) updateData.email = userData.email;
        if (userData.rut) updateData.rut = userData.rut;
        if (userData.direccion) updateData.direccion = userData.direccion;
        if (userData.ciudad) updateData.ciudad = userData.ciudad;
        if (userData.pais) updateData.pais = userData.pais;
        if (userData.telefono) updateData.telefono = userData.telefono;
        if (userData.instagram) updateData.instagram = userData.instagram;
        if (userData.fecha_nacimiento) updateData.fecha_nacimiento = userData.fecha_nacimiento;
        if (userData.tipo_cliente) updateData.tipo_cliente = userData.tipo_cliente;
        if (userData.usuario) updateData.usuario = userData.usuario;
        
        // Company fields
        if (userData.empresa_nombre) updateData.empresa_nombre = userData.empresa_nombre;
        if (userData.empresa_rut) updateData.empresa_rut = userData.empresa_rut;
        if (userData.empresa_ciudad) updateData.empresa_ciudad = userData.empresa_ciudad;
        if (userData.empresa_direccion) updateData.empresa_direccion = userData.empresa_direccion;
        
        // Document URLs
        if (userData.url_rut_anverso) updateData.url_rut_anverso = userData.url_rut_anverso;
        if (userData.url_rut_reverso) updateData.url_rut_reverso = userData.url_rut_reverso;
        if (userData.url_firma) updateData.url_firma = userData.url_firma;
        if (userData.url_empresa_erut) updateData.url_empresa_erut = userData.url_empresa_erut;
        if (userData.new_url_e_rut_empresa) updateData.new_url_e_rut_empresa = userData.new_url_e_rut_empresa;
        
        // Terms acceptance - convert boolean to string if needed
        if (userData.terminos_aceptados !== undefined) {
          updateData.terminos_aceptados = userData.terminos_aceptados === true || userData.terminos_aceptados === '1' ? '1' : '0';
        }

        console.log('📋 Updating user profile with data:', {
          user_id: user_id,
          fields: Object.keys(updateData),
          terminos_aceptados: updateData.terminos_aceptados
        });

        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(updateData)
          .eq('user_id', parseInt(user_id));

        if (updateError) {
          console.error('❌ Failed to update user profile:', updateError);
        } else {
          console.log('✅ User profile updated with contract URL and all user data');
        }
      } catch (dbError) {
        console.error('❌ Database update failed:', dbError);
        // Continue - we still have the PDF
      }
    }

    // Send email notification if requested
    let emailSent = false;
    console.log('🔍 Email sending check:', {
      sendEmail,
      hasContractUrl: !!contractUrl,
      contractUrl,
      hasUserEmail: !!userData.email,
      userEmail: userData.email
    });
    
    if (sendEmail && contractUrl && userData.email) {
      console.log('📧 Sending contract notification email...');
      
      try {
        // Import Resend
        const { Resend } = await import('resend');
        const resend = new Resend(import.meta.env.RESEND_API_KEY);
        
        if (!import.meta.env.RESEND_API_KEY) {
          console.error('❌ RESEND_API_KEY not configured');
          throw new Error('RESEND_API_KEY not configured');
        }
        
        // Generate HTML email content
        const emailData: ContractEmailData = {
          user_id: parseInt(user_id),
          nombre: userData.nombre,
          apellido: userData.apellido,
          email: userData.email,
          rut: userData.rut,
          telefono: userData.telefono,
          tipo_cliente: userData.tipo_cliente,
          empresa_nombre: userData.empresa_nombre,
          contractUrl: contractUrl
        };
        
        const htmlContent = generateContractEmailHTML(emailData);
        
        // Fetch PDF from R2 to attach it
        console.log('📎 Fetching PDF from R2 for email attachment...');
        const pdfResponse = await fetch(contractUrl);
        
        if (!pdfResponse.ok) {
          throw new Error(`Failed to fetch PDF from R2: ${pdfResponse.status}`);
        }
        
        const pdfArrayBuffer = await pdfResponse.arrayBuffer();
        console.log('✅ PDF fetched, size:', pdfArrayBuffer.byteLength, 'bytes');
        
        // Send email with Resend
        console.log('📧 Sending email to:', userData.email);
        const emailResult = await resend.emails.send({
          from: 'contratos@mail.mariohans.cl',
          to: [userData.email],
          subject: '✅ Contrato Generado - Mario Hans Rental',
          html: htmlContent,
          attachments: [{
            filename: `contrato_${user_id}.pdf`,
            content: Buffer.from(pdfArrayBuffer)
          }]
        });
        
        console.log('✅ Email sent successfully:', emailResult);
        emailSent = true;
        
      } catch (emailError) {
        console.error('❌ Failed to send email:', emailError);
        // Continue - email is not critical
      }
    }

    console.log('✅ Contract PDF generation completed successfully');

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: 'Contrato PDF generado exitosamente',
      contractUrl: contractUrl,
      pdfUrl: contractUrl, // For compatibility
      metadata: {
        user_id: parseInt(user_id),
        email: userData.email,
        generatedAt: new Date().toISOString(),
        fileSize: pdfBuffer.byteLength,
        uploadedToR2: uploadToR2 && !!contractUrl,
        emailSent: emailSent
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Internal contract PDF generation error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Error interno al generar contrato PDF',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

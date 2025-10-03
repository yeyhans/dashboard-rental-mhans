/**
 * Email Template Service
 * Generates HTML email templates inline (no external files)
 */
export class EmailTemplateService {
  
  // Format currency helper
  private static formatCLP(amount: string | number): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CL', { 
      style: 'currency', 
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numAmount);
  }

  /**
   * Generate HTML for completed order emails (same HTML for admin and customer)
   */
  private static generateCompletedOrderEmailHtml(data: {
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    customerCompany?: string;
    projectName: string;
    orderId: number;
    numJornadas: number;
    totalAmount: string;
    startDate: string;
    endDate: string;
    completedDate: string;
    lineItems?: Array<{ name: string; quantity: number; sku?: string }>;
    isAdmin: boolean;
  }): string {
    const jornadasText = data.numJornadas === 1 ? 'día' : 'días';
    const formattedTotal = this.formatCLP(data.totalAmount);
    
    const emailHtml = `
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
    <title>Gracias por tu pedido ${data.orderId}. Hemos recibido los equipos rentados, tras revisarlos, confirmamos que todo está en perfectas condiciones.</title>
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
    .mceDividerContainer{width:100%!important;}
    #b13 .mceTextBlockContainer{padding:12px 16px!important;}
    #gutterContainerId-13, #gutterContainerId-22, #gutterContainerId-25{padding:0!important;}
    #b20{padding:40px!important;}
    #b20 table{margin-right:auto!important;float:none!important;}
    #b22 .mceTextBlockContainer{padding:12px 24px!important;}
    #b23 .mceDividerBlock, #b29 .mceDividerBlock{border-top-width:1px!important;}
    #b23{padding:17px!important;}
    #b25 .mceTextBlockContainer{padding:20px!important;}
    #b29{padding:25px!important;}
    }
    @media only screen and (max-width: 640px) {
    .mceClusterLayout td{padding:4px!important;}
    }</style></head>
    <body>
    <!--*|IF:MC_PREVIEW_TEXT|*-->
    <!--[if !gte mso 9]><!----><span class="mcnPreviewText" style="display:none; font-size:0px; line-height:0px; max-height:0px; max-width:0px; opacity:0; overflow:hidden; visibility:hidden; mso-hide:all;">Gracias por tu pedido ${data.orderId}. Hemos recibido los equipos rentados, tras revisarlos, confirmamos que todo está en perfectas condiciones.</span><!--<![endif]-->
    <!--*|END:IF|*-->
    <div style="display: none; max-height: 0px; overflow: hidden;">͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌    ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­</div><!--MCE_TRACKING_PIXEL-->
    <center>
    <table border="0" cellpadding="0" cellspacing="0" height="100%" width="100%" id="bodyTable" style="background-color: rgb(235, 235, 235);">
    <tbody><tr>
    <td class="bodyCell" align="center" valign="top">
    <table id="root" border="0" cellpadding="0" cellspacing="0" width="100%"><tbody data-block-id="4" class="mceWrapper"><tr><td style="background-color:#ebebeb" valign="top" align="center" class="mceSectionHeader"><!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="660" style="width:660px;"><tr><td><![endif]--><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation"><tbody><tr><td style="background-color:#ffffff" valign="top" class="mceWrapperInner"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="3"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId--7" data-block-id="-7" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="background-color:#000000;padding-top:40px;padding-bottom:40px;padding-right:40px;padding-left:40px;border:0;border-radius:0" valign="top" class="mceImageBlockContainer" align="left" id="b20"><div><!--[if !mso]><!--></div><a href="https://rental.mariohans.cl" style="display:block" target="_blank" data-block-id="20"><table align="left" border="0" cellpadding="0" cellspacing="0" width="50%" style="border-collapse:separate;margin:0;vertical-align:top;max-width:50%;width:50%;height:auto" role="presentation" data-testid="image-20"><tbody><tr><td style="border:0;border-radius:0;margin:0" valign="top"><img alt="" src="https://mcusercontent.com/9ba4e87550786c74a0e5dc97e/images/87791a39-5396-8f56-d47d-22a92f2a3afe.png" width="290" height="auto" style="display:block;max-width:100%;height:auto;border-radius:0" class="imageDropZone mceLogo"/></td></tr></tbody></table></a><div><!--<![endif]--></div><div>
    <!--[if mso]>
    <a href="https://rental.mariohans.cl"><span class="mceImageBorder" style="border:0;border-width:2px;vertical-align:top;margin:0"><img role="presentation" class="imageDropZone mceLogo" src="https://mcusercontent.com/9ba4e87550786c74a0e5dc97e/images/87791a39-5396-8f56-d47d-22a92f2a3afe.png" alt="" width="290" height="auto" style="display:block;max-width:290px;width:290px;height:auto"/></span></a>
    <![endif]-->
    </div></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td></tr></tbody><tbody data-block-id="11" class="mceWrapper"><tr><td style="background-color:transparent" valign="top" align="center" class="mceSectionBody"><!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="660" style="width:660px;"><tr><td><![endif]--><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation"><tbody><tr><td style="background-color:#ffffff" valign="top" class="mceWrapperInner"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="10"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId--8" data-block-id="-8" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0" valign="top" class="mceGutterContainer" id="gutterContainerId-25"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" id="b25"><table width="100%" style="border:0;background-color:transparent;border-radius:0;border-collapse:separate"><tbody><tr><td style="padding-left:20px;padding-right:20px;padding-top:20px;padding-bottom:20px" class="mceTextBlockContainer"><div data-block-id="25" class="mceText" id="d25" style="width:100%"><p style="text-align: left;" class="last-child"><span style="color:rgb(0, 0, 0);"><span style="font-size: 15px">Pedido Completado.</span></span></p></div></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="background-color:transparent;padding-top:17px;padding-bottom:17px;padding-right:17px;padding-left:17px;border:0;border-radius:0" valign="top" class="mceDividerBlockContainer" id="b23"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:transparent;width:100%" role="presentation" class="mceDividerContainer" data-block-id="23"><tbody><tr><td style="min-width:100%;border-top-width:1px;border-top-style:solid;border-top-color:#000000;line-height:0;font-size:0" valign="top" class="mceDividerBlock"> </td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td></tr></tbody><tbody data-block-id="17" class="mceWrapper"><tr><td style="background-color:transparent" valign="top" align="center" class="mceSectionFooter"><!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="660" style="width:660px;"><tr><td><![endif]--><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation"><tbody><tr><td style="background-color:#ffffff" valign="top" class="mceWrapperInner"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="16"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId--9" data-block-id="-9" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0" valign="top" class="mceGutterContainer" id="gutterContainerId-22"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" id="b22"><table width="100%" style="border:0;background-color:transparent;border-radius:0;border-collapse:separate"><tbody><tr><td style="padding-left:24px;padding-right:24px;padding-top:12px;padding-bottom:12px" class="mceTextBlockContainer"><div data-block-id="22" class="mceText" id="d22" style="width:100%"><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Hola ${data.customerName},</span></span></span></span></p><p class="mcePastedContent"><br/></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Hemos recibido los equipos de tu </span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 15px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="background-color: #fefb41">pedido ${data.orderId}</span></span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">, tras revisarlos, confirmamos que </span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">todo está en perfectas condiciones</span></span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">. </span></span></span></span></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><br/></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Para completar el pago total del arriendo, aquí te dejamos los datos de nuestra cuenta bancaria:</span></span></span></span></p><p class="mcePastedContent"><br/></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">📌</span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;"> Datos de pago:</span></span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;"><br/></span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">HANS SALINAS SpA</span></span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;"><br/></span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">RUT:</span></span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;"> 77.892.569-9<br/></span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Banco de Chile</span></span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;"><br/></span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Cuenta Corriente
</span></span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;"><br/></span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">N° de cuenta:</span></span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;"> 8140915407<br/></span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Email:</span></span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;"> rental.mariohans@gmail.com</span></span></span></span></p><p class="mcePastedContent"><br/></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Te agradeceríamos que </span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif">nos envíes el comprobante de pago</span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;"> a este correo para cerrar el proceso de arriendo y </span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif">emitir la factura correspondiente a tu pedido.</span></span></span></strong></p><p class="mcePastedContent"><br/></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Si tienes cualquier duda, estamos aquí para ayudarte.</span></span></span></span></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><br/></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Saludos,<br/></span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Mario Hans FotoRental.</span></span></span></span></strong></p><p class="mcePastedContent last-child" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><br/></p></div></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="padding-top:12px;padding-bottom:12px;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" class="mceLayoutContainer" id="b27"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="27"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="24" width="100%" role="presentation"><tbody><tr><td valign="top" class="mceColumn" id="mceColumnId--6" data-block-id="-6" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="border:0;border-radius:0" valign="top" class="mceSocialFollowBlockContainer" id="b-5"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" class="mceSocialFollowBlock" data-block-id="-5"><tbody><tr><td valign="middle" align="center"><!--[if mso]><table align="left" border="0" cellspacing= "0" cellpadding="0"><tr><![endif]--><!--[if mso]><td align="center" valign="top"><![endif]--><table align="left" border="0" cellpadding="0" cellspacing="0" style="display:inline;float:left" role="presentation"><tbody><tr><td style="padding-top:3px;padding-bottom:3px;padding-left:12px;padding-right:12px" valign="top" class="mceSocialFollowIcon" align="center" width="24"><a href="https://instagram.com/mariohans" target="_blank" rel="noreferrer"><img class="mceSocialFollowImage" width="24" height="24" alt="Icono de Instagram" src="https://cdn-images.mailchimp.com/icons/social-block-v2/dark-instagram-48.png"/></a></td></tr></tbody></table><!--[if mso]></td><![endif]--><!--[if mso]><td align="center" valign="top"><![endif]--><table align="left" border="0" cellpadding="0" cellspacing="0" style="display:inline;float:left" role="presentation"><tbody><tr><td style="padding-top:3px;padding-bottom:3px;padding-left:12px;padding-right:12px" valign="top" class="mceSocialFollowIcon" align="center" width="24"><a href="https://web.whatsapp.com/send/?phone=5690818976" target="_blank" rel="noreferrer"><img class="mceSocialFollowImage" width="24" height="24" alt="Website icon" src="https://cdn-images.mailchimp.com/icons/social-block-v2/dark-link-48.png"/></a></td></tr></tbody></table><!--[if mso]></td><![endif]--><!--[if mso]></tr></table><![endif]--></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="background-color:transparent;padding-top:25px;padding-bottom:25px;padding-right:25px;padding-left:25px;border:0;border-radius:0" valign="top" class="mceDividerBlockContainer" id="b29"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:transparent;width:100%" role="presentation" class="mceDividerContainer" data-block-id="29"><tbody><tr><td style="min-width:100%;border-top-width:1px;border-top-style:solid;border-top-color:#000000;line-height:0;font-size:0" valign="top" class="mceDividerBlock"> </td></tr></tbody></table></td></tr>
    
    </tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td></tr></tbody></table>
    </td>
    </tr>
    </tbody></table>
    </center>
    <script type="text/javascript"  src="/6_u7pQA2/Omr9aMG/XUvxDLm/NW/iuL9cpk4JhpJrt/EhZlAQ/cDAdQR/RLRDc"></script></body></html>`;

    return emailHtml;
  }

  /**
   * Generate HTML for failed order emails (same HTML for admin and customer)
   */
  private static generateFailedOrderEmailHtml(data: {
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    customerCompany?: string;
    projectName: string;
    orderId: number;
    numJornadas: number;
    totalAmount: string;
    startDate: string;
    endDate: string;
    failedDate: string;
    lineItems?: Array<{ name: string; quantity: number; sku?: string }>;
    failureReason?: string;
    customMessage?: string;
    isAdmin: boolean;
  }): string {
    const jornadasText = data.numJornadas === 1 ? 'día' : 'días';
    const formattedTotal = this.formatCLP(data.totalAmount);
    
    const emailHtml = `
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
.mceDividerContainer{width:100%!important;}
#b13 .mceTextBlockContainer{padding:12px 16px!important;}
#gutterContainerId-13, #gutterContainerId-22, #gutterContainerId-25{padding:0!important;}
#b20{padding:40px!important;}
#b20 table{margin-right:auto!important;float:none!important;}
#b22 .mceTextBlockContainer{padding:12px 24px!important;}
#b23 .mceDividerBlock, #b29 .mceDividerBlock{border-top-width:1px!important;}
#b23{padding:17px!important;}
#b25 .mceTextBlockContainer{padding:20px!important;}
#b29{padding:25px!important;}
}
@media only screen and (max-width: 640px) {
.mceClusterLayout td{padding:4px!important;}
}</style></head>
<body>
<!--*|IF:MC_PREVIEW_TEXT|*-->
<!--[if !gte mso 9]><!----><span class="mcnPreviewText" style="display:none; font-size:0px; line-height:0px; max-height:0px; max-width:0px; opacity:0; overflow:hidden; visibility:hidden; mso-hide:all;">Gracias por confiar en Mario Hans FotoRental. Lamentamos informarte que los equipos que solicitaste no están disponibles para las fechas indicadas.</span><!--<![endif]-->
<!--*|END:IF|*-->
<div style="display: none; max-height: 0px; overflow: hidden;">͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌      ͏ ‌    ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­ ­</div><!--MCE_TRACKING_PIXEL-->
<center>
<table border="0" cellpadding="0" cellspacing="0" height="100%" width="100%" id="bodyTable" style="background-color: rgb(235, 235, 235);">
<tbody><tr>
<td class="bodyCell" align="center" valign="top">
<table id="root" border="0" cellpadding="0" cellspacing="0" width="100%"><tbody data-block-id="4" class="mceWrapper"><tr><td style="background-color:#ebebeb" valign="top" align="center" class="mceSectionHeader"><!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="660" style="width:660px;"><tr><td><![endif]--><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation"><tbody><tr><td style="background-color:#ffffff" valign="top" class="mceWrapperInner"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="3"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId--7" data-block-id="-7" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="background-color:#000000;padding-top:40px;padding-bottom:40px;padding-right:40px;padding-left:40px;border:0;border-radius:0" valign="top" class="mceImageBlockContainer" align="left" id="b20"><div><!--[if !mso]><!--></div><a href="https://rental.mariohans.cl" style="display:block" target="_blank" data-block-id="20"><table align="left" border="0" cellpadding="0" cellspacing="0" width="50%" style="border-collapse:separate;margin:0;vertical-align:top;max-width:50%;width:50%;height:auto" role="presentation" data-testid="image-20"><tbody><tr><td style="border:0;border-radius:0;margin:0" valign="top"><img alt="" src="https://mcusercontent.com/9ba4e87550786c74a0e5dc97e/images/87791a39-5396-8f56-d47d-22a92f2a3afe.png" width="290" height="auto" style="display:block;max-width:100%;height:auto;border-radius:0" class="imageDropZone mceLogo"/></td></tr></tbody></table></a><div><!--<![endif]--></div><div>
<!--[if mso]>
<a href="https://rental.mariohans.cl"><span class="mceImageBorder" style="border:0;border-width:2px;vertical-align:top;margin:0"><img role="presentation" class="imageDropZone mceLogo" src="https://mcusercontent.com/9ba4e87550786c74a0e5dc97e/images/87791a39-5396-8f56-d47d-22a92f2a3afe.png" alt="" width="290" height="auto" style="display:block;max-width:290px;width:290px;height:auto"/></span></a>
<![endif]-->
</div></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td></tr></tbody><tbody data-block-id="11" class="mceWrapper"><tr><td style="background-color:transparent" valign="top" align="center" class="mceSectionBody"><!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="660" style="width:660px;"><tr><td><![endif]--><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation"><tbody><tr><td style="background-color:#ffffff" valign="top" class="mceWrapperInner"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="10"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId--8" data-block-id="-8" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0" valign="top" class="mceGutterContainer" id="gutterContainerId-25"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" id="b25"><table width="100%" style="border:0;background-color:transparent;border-radius:0;border-collapse:separate"><tbody><tr><td style="padding-left:20px;padding-right:20px;padding-top:20px;padding-bottom:20px" class="mceTextBlockContainer"><div data-block-id="25" class="mceText" id="d25" style="width:100%"><p style="text-align: left;" class="last-child"><span style="color:rgb(0, 0, 0);"><span style="font-size: 15px">Disponibilidad de equipos.</span></span></p></div></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="background-color:transparent;padding-top:17px;padding-bottom:17px;padding-right:17px;padding-left:17px;border:0;border-radius:0" valign="top" class="mceDividerBlockContainer" id="b23"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:transparent;width:100%" role="presentation" class="mceDividerContainer" data-block-id="23"><tbody><tr><td style="min-width:100%;border-top-width:1px;border-top-style:solid;border-top-color:#000000;line-height:0;font-size:0" valign="top" class="mceDividerBlock"> </td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td></tr></tbody><tbody data-block-id="17" class="mceWrapper"><tr><td style="background-color:transparent" valign="top" align="center" class="mceSectionFooter"><!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="660" style="width:660px;"><tr><td><![endif]--><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px" role="presentation"><tbody><tr><td style="background-color:#ffffff" valign="top" class="mceWrapperInner"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="16"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0" valign="top" class="mceColumn" id="mceColumnId--9" data-block-id="-9" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0" valign="top" class="mceGutterContainer" id="gutterContainerId-22"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate" role="presentation"><tbody><tr><td style="padding-top:0;padding-bottom:0;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" id="b22"><table width="100%" style="border:0;background-color:transparent;border-radius:0;border-collapse:separate"><tbody><tr><td style="padding-left:24px;padding-right:24px;padding-top:12px;padding-bottom:12px" class="mceTextBlockContainer"><div data-block-id="22" class="mceText" id="d22" style="width:100%"><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Hola ${data.customerName},</span></span></span></span></p><p class="mcePastedContent"><br/></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Gracias por confiar en </span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Mario Hans FotoRental</span></span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">. Lamentamos informarte que los equipos que solicitaste </span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif">no están disponibles para las fechas indicadas.</span></span></span></strong></p><p class="mcePastedContent"><br/></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Si lo deseas, podemos ayudarte a encontrar una </span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">alternativa</span></span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;"> o revisar la disponibilidad en </span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">otras fechas</span></span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">.</span></span></span></span></p><p class="mcePastedContent"><br/></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Si tienes dudas o necesitas hacer algún ajuste, </span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif">escríbenos o contáctanos directamente por WhatsApp.</span></span></span></strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;"> ¡Estamos aquí para ayudarte!</span></span></span></span></p><p class="mcePastedContent"><br/></p><p class="mcePastedContent" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Saludos,<br/></span></span></span></span><strong><span style="color:#000000;"><span style="font-size: 13px"><span style="font-family: 'Source Code Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif"><span style="font-weight:normal;">Mario Hans FotoRental.</span></span></span></span></strong></p><p class="mcePastedContent last-child" style="margin: 0.0px 0.0px 0.0px 0.0px; font: 13.0px 'Helvetica Neue';"><br/></p></div></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="padding-top:12px;padding-bottom:12px;padding-right:0;padding-left:0;border:0;border-radius:0" valign="top" class="mceLayoutContainer" id="b27"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" data-block-id="27"><tbody><tr class="mceRow"><td style="background-position:center;background-repeat:no-repeat;background-size:cover" valign="top"><table border="0" cellpadding="0" cellspacing="24" width="100%" role="presentation"><tbody><tr><td valign="top" class="mceColumn" id="mceColumnId--6" data-block-id="-6" colspan="12" width="100%"><table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tbody><tr><td style="border:0;border-radius:0" valign="top" class="mceSocialFollowBlockContainer" id="b-5"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" class="mceSocialFollowBlock" data-block-id="-5"><tbody><tr><td valign="middle" align="center"><!--[if mso]><table align="left" border="0" cellspacing= "0" cellpadding="0"><tr><![endif]--><!--[if mso]><td align="center" valign="top"><![endif]--><table align="left" border="0" cellpadding="0" cellspacing="0" style="display:inline;float:left" role="presentation"><tbody><tr><td style="padding-top:3px;padding-bottom:3px;padding-left:12px;padding-right:12px" valign="top" class="mceSocialFollowIcon" align="center" width="24"><a href="https://instagram.com/mariohans" target="_blank" rel="noreferrer"><img class="mceSocialFollowImage" width="24" height="24" alt="Icono de Instagram" src="https://cdn-images.mailchimp.com/icons/social-block-v2/dark-instagram-48.png"/></a></td></tr></tbody></table><!--[if mso]></td><![endif]--><!--[if mso]><td align="center" valign="top"><![endif]--><table align="left" border="0" cellpadding="0" cellspacing="0" style="display:inline;float:left" role="presentation"><tbody><tr><td style="padding-top:3px;padding-bottom:3px;padding-left:12px;padding-right:12px" valign="top" class="mceSocialFollowIcon" align="center" width="24"><a href="https://web.whatsapp.com/send/?phone=5690818976" target="_blank" rel="noreferrer"><img class="mceSocialFollowImage" width="24" height="24" alt="Website icon" src="https://cdn-images.mailchimp.com/icons/social-block-v2/dark-link-48.png"/></a></td></tr></tbody></table><!--[if mso]></td><![endif]--><!--[if mso]></tr></table><![endif]--></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td style="background-color:transparent;padding-top:25px;padding-bottom:25px;padding-right:25px;padding-left:25px;border:0;border-radius:0" valign="top" class="mceDividerBlockContainer" id="b29"><table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:transparent;width:100%" role="presentation" class="mceDividerContainer" data-block-id="29"><tbody><tr><td style="min-width:100%;border-top-width:1px;border-top-style:solid;border-top-color:#000000;line-height:0;font-size:0" valign="top" class="mceDividerBlock"> </td></tr></tbody></table></td></tr><tr>
    
</tr>
</tbody></table>
</center>
<script type="text/javascript"  src="/6_u7pQA2/Omr9aMG/XUvxDLm/NW/iuL9cpk4JhpJrt/EhZlAQ/cDAdQR/RLRDc"></script></body></html>
`;

    return emailHtml;
  }

  // Public methods for completed order emails
  static generateCompletedOrderCustomerEmail(data: {
    customerName: string;
    projectName: string;
    orderId: number;
    numJornadas: number;
    totalAmount: string;
    startDate: string;
    endDate: string;
    completedDate: string;
    lineItems?: Array<{ name: string; quantity: number; sku?: string }>;
    customMessage?: string;
  }): string {
    return this.generateCompletedOrderEmailHtml({
      ...data,
      isAdmin: false,
    });
  }

  static generateCompletedOrderAdminEmail(data: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerCompany: string;
    projectName: string;
    orderId: number;
    numJornadas: number;
    totalAmount: string;
    startDate: string;
    endDate: string;
    completedDate: string;
    lineItems?: Array<{ name: string; quantity: number; sku?: string }>;
    customerEmailContent: string;
  }): string {
    return this.generateCompletedOrderEmailHtml({
      ...data,
      isAdmin: true,
    });
  }

  // Public methods for failed order emails
  static generateFailedOrderCustomerEmail(data: {
    customerName: string;
    projectName: string;
    orderId: number;
    numJornadas: number;
    totalAmount: string;
    startDate: string;
    endDate: string;
    failedDate: string;
    lineItems?: Array<{ name: string; quantity: number; sku?: string }>;
    customMessage?: string;
    failureReason?: string;
  }): string {
    return this.generateFailedOrderEmailHtml({
      ...data,
      isAdmin: false,
    });
  }

  static generateFailedOrderAdminEmail(data: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerCompany: string;
    projectName: string;
    orderId: number;
    numJornadas: number;
    totalAmount: string;
    startDate: string;
    endDate: string;
    failedDate: string;
    lineItems?: Array<{ name: string; quantity: number; sku?: string }>;
    failureReason?: string;
    customerEmailContent: string;
  }): string {
    return this.generateFailedOrderEmailHtml({
      ...data,
      isAdmin: true,
    });
  }
}

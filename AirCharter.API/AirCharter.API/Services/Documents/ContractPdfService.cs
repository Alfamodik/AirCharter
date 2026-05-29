using System.Globalization;
using MigraDoc.DocumentObjectModel;
using MigraDoc.DocumentObjectModel.Tables;
using MigraDoc.Rendering;

namespace AirCharter.API.Services.Documents;

public sealed class ContractPdfService
{
    private static readonly CultureInfo RussianCulture = CultureInfo.GetCultureInfo("ru-RU");

    public byte[] Generate(ContractPdfData data)
    {
        Document document = new Document();
        DefineStyles(document);

        Section section = CreateSection(document);
        AddContractSection(section, data);
        AddAppendixTitle(section, data);
        section.AddPageBreak();
        AddOrderSection(section, data);

        PdfDocumentRenderer pdfDocumentRenderer = new PdfDocumentRenderer
        {
            Document = document
        };

        pdfDocumentRenderer.RenderDocument();

        using MemoryStream memoryStream = new MemoryStream();
        pdfDocumentRenderer.PdfDocument.Save(memoryStream, false);

        return memoryStream.ToArray();
    }

    private static void AddContractSection(Section section, ContractPdfData data)
    {
        AddCenteredTitle(section, "ДОГОВОР", 10);
        AddCenteredTitle(section, "на предоставление услуг", 10);
        AddCenteredTitle(
            section,
            $"по организации чартерной воздушной перевозки № {data.ContractNumber}",
            10,
            12);

        AddDateLine(section, data.ContractCity, data.ContractDate);
        AddPreamble(section, data, "настоящий Договор");

        AddSectionHeading(section, "1.", "ПРЕДМЕТ ДОГОВОРА");
        AddClause(
            section,
            "1.1.",
            "Исполнитель предоставляет Заказчику услуги по организации чартерных воздушных перевозок, а также дополнительные услуги, связанные с их организацией, по заявкам Заказчика.");
        AddClause(
            section,
            "1.2.",
            "Вся деятельность Исполнителя, связанная с организацией выполнения чартерной воздушной перевозки, ее маршрута, графика движения, типом и компоновкой воздушного судна, а также с иными условиями исполнения, осуществляется на основании Заказа Заказчика, являющегося неотъемлемой частью настоящего Договора. Правила оформления Заказа указаны в ст. 7 настоящего Договора.");

        AddSectionHeading(section, "2.", "ПРАВА И ОБЯЗАННОСТИ СТОРОН");
        AddClause(section, "2.1.", "Обязанности и права Исполнителя", true);
        AddClause(
            section,
            "2.1.1.",
            "На основании Заказа Заказчика Исполнитель, по мере необходимости, привлекая третьих лиц, организует услуги:\nФрахтование воздушного судна соответствующего типа и компоновки, в надлежащем состоянии для осуществления полета, с экипажем, состав и квалификация которого отвечает всем необходимым правилам и требованиям, согласно дате выполнения перевозки, маршруту, графику движения;\nДополнительные услуги.");
        AddClause(
            section,
            "2.1.2.",
            "При невозможности предоставить указанное в Заявке воздушное судно, предварительно уведомив Заказчика, Исполнитель имеет право произвести замену воздушного судна на аналогичное ему по комфорту, без изменения условий настоящего Договора.");
        AddClause(
            section,
            "2.1.3.",
            "Исполнитель имеет право отказать в перевозке:\nВ целях обеспечения безопасности полета, безопасности пассажиров;\nВ целях предотвращения нарушений соответствующих законов, постановлений, правил и предписаний государственных органов;\nВ случае отсутствия и/или неправильных документов у пассажиров на въезд в страну по маршруту выполнения перевозки;\nВследствие отказа пассажира выполнять правила и инструкции Исполнителя и Командира воздушного судна;\nВследствие существенных изменений Заказчиком параметров его Заявки, если внесенные изменения не позволяют обеспечить организацию рейса в срок до даты выполнения перевозки.");
        AddClause(
            section,
            "2.1.4.",
            "Командир воздушного судна осуществляет полный контроль над выполнением перевозки и управлением воздушным судном. Его решения по вопросам обеспечения безопасности полета являются окончательными и обязательными для Заказчика.");
        AddClause(section, "2.2.", "Обязанности и права Заказчика", true);
        AddClause(section, "2.2.1.", "Заказчик оплачивает услуги Исполнителя полностью и точно в указанные в Договоре сроки.");
        AddClause(section, "2.2.2.", "Заказчик не будет передавать свои права и обязанности по настоящему Договору третьим лицам.");
        AddClause(section, "2.2.3.", "Заказчик обязуется выполнять все требования и распоряжения командира воздушного судна, а также правила и инструкции Исполнителя.");
        AddClause(section, "2.2.4.", "Заказчик обязуется аккуратно обращаться с предоставленным ему имуществом воздушного судна. В случае порчи данного имущества Заказчиком, Заказчик возместит Исполнителю причиненные убытки.");
        AddClause(section, "2.2.5.", $"Заказчик обеспечит прибытие пассажиров, груза и багажа в аэропорт отправления за {data.PassengerArrivalText} до вылета рейса. Заказчик также обеспечит наличие у пассажиров всех необходимых документов для выполнения перевозки.");
        AddClause(section, "2.2.6.", "Заказчик информирует пассажиров об условиях перевозки, правилах пребывания и видах услуг на борту, а также требованиях законодательства РФ, распространяющихся на виды обслуживания согласно настоящему Договору.");
        AddClause(section, "2.2.7.", "Заказчик предоставляет Исполнителю не позднее, чем за 2 рабочих дня до вылета рейса данные о пассажирах.");

        AddSectionHeading(section, "3.", "РАСЧЕТЫ");
        AddClause(section, "3.1.", "Стоимость услуг Исполнителя и сроки платежей указаны в Приложениях / Заказах к настоящему Договору.");
        AddClause(section, "3.2.", "Стоимость услуг Исполнителя относительно каждой заявки Заказчика рассчитывается в зависимости от сроков подачи заявки, маршрута, типа воздушного судна, категории дополнительных услуг.");
        AddClause(section, "3.3.", "В случае увеличения фактической стоимости услуг (увеличение цен на авиатопливо, бортпитание, сборов за аэропортовые услуги, обработка антиобледенительной жидкостью, аэронавигационных сборов, налогов и сборов), Заказчик оплачивает дополнительные расходы не позднее 6 (шести) банковских дней с момента выставления счета Исполнителем.");
        AddClause(section, "3.4.", "Все дополнительные расходы Исполнителя, не относящиеся к организации чартерной воздушной перевозки и дополнительным услугам в соответствии с Заказом, которые могут возникнуть по вине или по инициативе Заказчика, несет Заказчик.");
        AddBodyParagraph(section, "Дополнительно, в случае просрочки платежа, согласно соответствующему Приложению, Заказчик уплачивает пени в размере 0,1% за каждый день просрочки от не перечисленной суммы, но не более 10% от первоначальной общей стоимости услуг по организации воздушной перевозки и дополнительных услуг.");

        AddSectionHeading(section, "4.", "ОТВЕТСТВЕННОСТЬ СТОРОН");
        AddClause(section, "4.1.", "Исполнитель и Заказчик не несут друг перед другом ответственности, если они не смогут выполнить взятые по Договору обязательства в результате действия непреодолимой силы (форс-мажор), как-то: метеоусловия, правительственные акты, забастовки или какие-либо другие факты, выходящие из-под контроля Исполнителя и Заказчика.");
        AddClause(section, "4.2.", "В случае наступления форс-мажорных обстоятельств, расходы и издержки Стороны несут самостоятельно.");
        AddClause(section, "4.3.", "Заказчик несет ответственность за все последствия, связанные с неправильным оформлением документов пассажиров и возместит Исполнителю понесенные затраты, причиненные данными последствиями.");
        AddClause(section, "4.4.", "Стороны настоящим подтверждают, что Исполнитель не несет ответственности за любые задержки оказания услуг, вызванные действиями/бездействиями оператора, перевозчика, поставщиков услуг, составляющих услуги по настоящему Договору, и/или компетентных органов, при условии что такая ситуация находится вне разумного контроля Исполнителя и исключает его вину.");
        AddClause(section, "4.5.", "В случае нарушения условий Заказа непосредственно третьими лицами (Оператором, фактическим Перевозчиком, поставщиками дополнительных услуг по заявке Заказчика) и не по вине Исполнителя, Исполнитель приложит все разумные усилия, в меру возможности, для урегулирования в интересах Заказчика вопросов возмещения причиненных Заказчику убытков.");
        AddClause(section, "4.6.", "Исполнитель ни при каких обстоятельствах не несет ответственности за любые косвенные, непрямые, случайные убытки, ущерб, затраты или расходы, а также упущенную выгоду, потерю прибыли, контрактов или бизнеса.");
        AddClause(section, "4.7.", "При отказе Заказчика от услуг по Заявке Заказчик возмещает Исполнителю все фактически понесенные расходы в связи с исполнением обязательств по Договору до момента отказа Заказчика.");
        AddClause(section, "4.8.", "В случае изменения условий выполнения рейса не по вине Исполнителя стоимость услуг по соответствующей Заявке может быть увеличена по требованию Исполнителя на сумму соответствующих фактических расходов, связанных с такими изменениями рейса.");
        AddClause(section, "4.9.", "Ответственность Сторон за неисполнение своих обязательств по настоящему Договору, в том числе и за отказ от перевозки в соответствии с Заказом, устанавливается индивидуально и закрепляется отдельным пунктом в конкретном Заказе.");

        AddSectionHeading(section, "5.", "СРОК И ПОРЯДОК ДЕЙСТВИЯ ДОГОВОРА");
        AddClause(section, "5.1.", $"Настоящий Договор вступает в силу с момента подписания его обеими Сторонами и действует по {FormatDateLong(data.ContractEndDate)} либо до полного исполнения Сторонами принятых на себя обязательств по настоящему Договору.");
        AddClause(section, "5.2.", "Если за 30 дней до истечения срока действия Договора ни одна из Сторон не заявит о его прекращении, Договор считается возобновленным на тех же условиях, на тот же срок.");
        AddClause(section, "5.3.", "В случае, если один или несколько пунктов Договора окажутся незаконными или неосуществимыми, остальные пункты сохраняют законную силу и обязательность их выполнения.");
        AddClause(section, "5.4.", "Настоящий Договор составлен в двух идентичных экземплярах, имеющих одинаковую юридическую силу, по одному экземпляру для каждой из Сторон.");
        AddClause(section, "5.5.", "Любые изменения и дополнения к настоящему Договору действительны при условии, если составлены в письменной форме и подписаны уполномоченными представителями Сторон.");
        AddClause(section, "5.6.", "Стороны признают, что любая переписка, корреспонденция по настоящему Договору, отправленные по факсу, почте или электронной связи по адресам, указанным в настоящем Договоре, имеют обязательную для обеих сторон юридическую силу.");
        AddClause(section, "5.7.", "Во всем остальном, что не предусмотрено настоящим Договором, Стороны руководствуются действующим законодательством Российской Федерации, международными Конвенциями и Соглашениями, участником которых является РФ. При коллизии права закрепляется приоритет международных норм.");

        AddSectionHeading(section, "6.", "ПОРЯДОК РАСТОРЖЕНИЯ ДОГОВОРА");
        AddClause(section, "6.1.", "Настоящий Договор может быть расторгнут одной Стороной в одностороннем порядке при условии письменного уведомления другой Стороны не менее чем за 30 (тридцать) дней.");
        AddClause(section, "6.2.", "При расторжении настоящего Договора Стороны составляют акт о взаиморасчетах. Настоящий Договор считается расторгнутым после полного исполнения всех обязательств по Договору между Сторонами.");

        AddSectionHeading(section, "7.", "ЗАКАЗ И ЗАЯВКА");
        AddClause(section, "7.1.", "Заказчик направляет Исполнителю предварительную Заявку в произвольной форме на организацию чартерной воздушной перевозки и дополнительные услуги посредством телефонной, факсимильной или электронной связи.");
        AddClause(section, "7.2.", "Исполнитель принимает предварительную Заявку к обработке. Исполнитель направляет Заказчику посредством телефонной, факсимильной или электронной связи Предложение с указанием стоимости и условий организации перевозки и дополнительных услуг.");
        AddClause(section, "7.3.", "При достижении соглашения по стоимости и условиям, Стороны подписывают документ, являющийся Заказом на организацию чартерной воздушной перевозки и дополнительные услуги. Условия настоящего Договора влекут за собой обязательства Сторон только при условии документального оформления и подписания Сторонами формы конкретного Заказа.");

        AddSectionHeading(section, "8.", "РАССМОТРЕНИЕ СПОРОВ");
        AddClause(section, "8.1.", "Стороны будут стремиться решать споры и разногласия, возникшие в процессе исполнения настоящего Договора, путем переговоров.");
        AddClause(section, "8.2.", "Споры и разногласия, не разрешенные в результате переговоров, подлежат рассмотрению в Арбитражном суде города Москвы.");

        AddRequisites(section, data);
        AddSignatureBlock(section, data);
    }

    private static void AddOrderSection(Section section, ContractPdfData data)
    {
        AddCenteredTitle(section, $"ЗАКАЗ № {data.OrderNumber}", 10);
        AddCenteredTitle(section, "на предоставление услуг", 10);
        AddCenteredTitle(section, "по организации чартерной воздушной перевозки", 10, 12);

        AddDateLine(section, data.ContractCity, data.ContractDate);
        AddPreamble(section, data, "настоящий Договор");

        Paragraph aircraftParagraph = section.AddParagraph();
        aircraftParagraph.Format.SpaceBefore = Unit.FromPoint(4);
        aircraftParagraph.AddFormattedText($"Воздушное судно: {data.PlaneModelName}", TextFormat.Bold);

        Paragraph routeTitle = AddClauseStart(section, "1.");
        routeTitle.AddFormattedText("Маршрут и график движения", TextFormat.Bold);
        routeTitle.AddText(" (время местное)");
        AddRouteTable(section, data);

        AddClause(section, "2.", $"Бортпитание пассажиров - {data.CateringClass}");
        AddClause(section, "3.", "Выполнение перевозки зависит от разрешений на пролет территории и посадку по маршруту полета от местных властей, слотов в а/п, метеоусловий.", true);
        AddClause(section, "4.", "Курение на борту воздушного судна: запрещается.", true);
        AddClause(section, "5.", "Штраф за простой ВС: 1% от стоимости рейса, при задержке свыше двух часов по вине Заказчика", true);

        Paragraph cancellation = AddClauseStart(section, "6.");
        cancellation.AddFormattedText(
            "Ответственность сторон (Исполнителя и Заказчика) (размер и порядок выплаты неустойки) согласно п. 4.5. Договора:",
            TextFormat.Bold);
        AddIndentedParagraph(section, "-25% от общей стоимости услуг при отмене с момента подписания настоящего Приложения, но более чем за три дня до даты вылета (совершения рейса);", true);
        AddIndentedParagraph(section, "-50% от общей стоимости услуг при отмене за 3 дня до даты вылета (совершения рейса);", true);
        AddIndentedParagraph(section, "-100% от общей стоимости услуг при отмене за сутки до вылета воздушного судна из аэропорта отправления.", true);

        AddHeading(section, "Стоимость услуг и условия платежа");
        AddBodyParagraph(section, $"Стоимость составляет - {data.FlightPrice.ToString("N0", RussianCulture)} ₽ ({data.FlightPriceText}), Стоимость услуг не облагается НДС на основании ст.346.11 главы 26.2 НК РФ.");
        AddBodyParagraph(section, $"Оплата производится в рублях Российской Федерации путем перечисления на расчетный счет Исполнителя до {FormatDateLong(data.PaymentDeadlineDate)}.");

        AddUnderlinedHeading(section, "В стоимость услуг включены:");
        AddBodyParagraph(section, $"аренда самолета с экипажем, сборы за взлет-посадку, сборы за аэропортовые услуги, АНО обслуживание на маршруте и в районе аэродрома, расходы по заправке ВС топливом на полет, сборы за обслуживание пассажиров в залах прилета и вылета, бортовое питание класса {data.CateringClass}, обязательное страхование пассажиров, сборы за получение разрешений на выполнение рейса.");

        AddUnderlinedHeading(section, "В стоимость услуг не включено:");
        AddBodyParagraph(section, "а) обработка самолета антиобледенительной жидкостью;\nб) любые другие дополнительные расходы за услуги, не указанные в Заказе;\nв) изменение даты вылета;\nг) изменение количества пассажиров;\nизменение маршрута, любые дополнительные посадки, в том числе связанные с уходом самолета на запасной аэродром по причине плохой погоды;\nг) продление регламента аэропортов.");

        AddSignatureBlock(section, data);
    }

    private static Section CreateSection(Document document)
    {
        Section section = document.AddSection();
        section.PageSetup.PageFormat = PageFormat.A4;
        section.PageSetup.Orientation = Orientation.Portrait;
        section.PageSetup.TopMargin = Unit.FromCentimeter(1.25);
        section.PageSetup.BottomMargin = Unit.FromCentimeter(1.1);
        section.PageSetup.LeftMargin = Unit.FromCentimeter(0.95);
        section.PageSetup.RightMargin = Unit.FromCentimeter(0.95);
        section.PageSetup.HeaderDistance = Unit.FromCentimeter(0.65);
        section.PageSetup.FooterDistance = Unit.FromCentimeter(0.25);

        AddRunningHeaderAndFooter(section);

        return section;
    }

    private static void AddRunningHeaderAndFooter(Section section)
    {
        Paragraph header = section.Headers.Primary.AddParagraph("Является публичной офертой");
        header.Format.Alignment = ParagraphAlignment.Right;
        header.Format.Font.Name = "Arial";
        header.Format.Font.Size = Unit.FromPoint(8);

        Table footer = section.Footers.Primary.AddTable();
        footer.Borders.Visible = false;
        footer.AddColumn(Unit.FromCentimeter(9.4));
        footer.AddColumn(Unit.FromCentimeter(9.4));

        Row row = footer.AddRow();
        row.Format.Font.Size = Unit.FromPoint(7.2);
        row.Cells[0].AddParagraph("Исполнитель________________________");
        row.Cells[1].AddParagraph("Заказчик________________________");
    }

    private static void AddPreamble(Section section, ContractPdfData data, string documentName)
    {
        string executorPosition = FormatExecutorPositionForPreamble(data.ExecutorDirectorPosition);

        AddBodyParagraph(
            section,
            $"{data.ExecutorFullName}, в дальнейшем именуемое \"Исполнитель\", в лице {executorPosition} {data.ExecutorDirectorFullName}, действующего на основании Устава, с одной стороны и {data.CustomerFullName}, далее именуемый \"Заказчик\", с другой стороны, вместе именуемые \"Стороны\", заключили {documentName} о нижеследующем.",
            firstLineIndent: Unit.FromCentimeter(0.9));
    }

    private static void AddDateLine(Section section, string city, DateTime date)
    {
        Table table = section.AddTable();
        table.Borders.Visible = false;
        table.AddColumn(Unit.FromCentimeter(9.0));
        table.AddColumn(Unit.FromCentimeter(9.8));

        Row row = table.AddRow();
        row.Cells[0].AddParagraph($"г. {city}");
        row.Cells[1].AddParagraph(FormatDateLong(date)).Format.Alignment = ParagraphAlignment.Right;

        Paragraph spacer = section.AddParagraph();
        spacer.Format.SpaceAfter = Unit.FromPoint(4);
    }

    private static void AddSectionHeading(Section section, string number, string title)
    {
        Paragraph paragraph = section.AddParagraph($"{number}        {title}");
        paragraph.Format.Alignment = ParagraphAlignment.Center;
        paragraph.Format.Font.Bold = true;
        paragraph.Format.Font.Size = Unit.FromPoint(10);
        paragraph.Format.SpaceBefore = Unit.FromPoint(12);
        paragraph.Format.SpaceAfter = Unit.FromPoint(10);
        paragraph.Format.KeepWithNext = true;
    }

    private static void AddHeading(Section section, string text)
    {
        Paragraph paragraph = section.AddParagraph(text);
        paragraph.Format.Font.Bold = true;
        paragraph.Format.SpaceBefore = Unit.FromPoint(5);
        paragraph.Format.SpaceAfter = Unit.FromPoint(2);
        paragraph.Format.KeepWithNext = true;
    }

    private static void AddUnderlinedHeading(Section section, string text)
    {
        Paragraph paragraph = section.AddParagraph();
        paragraph.Format.SpaceBefore = Unit.FromPoint(2);
        paragraph.Format.SpaceAfter = Unit.FromPoint(0);
        FormattedText formattedText = paragraph.AddFormattedText(text);
        formattedText.Bold = true;
        formattedText.Underline = Underline.Single;
    }

    private static void AddCenteredTitle(
        Section section,
        string text,
        double fontSize,
        double spaceAfter = 0)
    {
        Paragraph paragraph = section.AddParagraph(text);
        paragraph.Format.Alignment = ParagraphAlignment.Center;
        paragraph.Format.Font.Bold = true;
        paragraph.Format.Font.Size = Unit.FromPoint(fontSize);
        paragraph.Format.SpaceAfter = Unit.FromPoint(spaceAfter);
    }

    private static Paragraph AddClauseStart(Section section, string number)
    {
        Paragraph paragraph = section.AddParagraph();
        paragraph.Format.LeftIndent = Unit.FromCentimeter(1.1);
        paragraph.Format.FirstLineIndent = Unit.FromCentimeter(-1.1);
        paragraph.Format.TabStops.AddTabStop(Unit.FromCentimeter(1.1), TabAlignment.Left);
        paragraph.Format.SpaceAfter = Unit.FromPoint(1);
        paragraph.AddText(number);
        paragraph.AddTab();

        return paragraph;
    }

    private static void AddClause(
        Section section,
        string number,
        string text,
        bool bold = false)
    {
        Paragraph paragraph = AddClauseStart(section, number);

        if (bold)
        {
            AddFormattedTextWithLineBreaks(paragraph, text, TextFormat.Bold);
            return;
        }

        AddTextWithLineBreaks(paragraph, text);
    }

    private static void AddBodyParagraph(
        Section section,
        string text,
        Unit? firstLineIndent = null)
    {
        Paragraph paragraph = section.AddParagraph();
        paragraph.Format.SpaceAfter = Unit.FromPoint(2);

        if (firstLineIndent.HasValue)
            paragraph.Format.FirstLineIndent = firstLineIndent.Value;

        AddTextWithLineBreaks(paragraph, text);
    }

    private static void AddIndentedParagraph(Section section, string text, bool bold = false)
    {
        Paragraph paragraph = section.AddParagraph();
        paragraph.Format.LeftIndent = Unit.FromCentimeter(1.45);
        paragraph.Format.SpaceAfter = Unit.FromPoint(0);

        if (bold)
            AddFormattedTextWithLineBreaks(paragraph, text, TextFormat.Bold);
        else
            AddTextWithLineBreaks(paragraph, text);
    }

    private static void AddTextWithLineBreaks(Paragraph paragraph, string text)
    {
        string[] lines = text.Split('\n');

        for (int index = 0; index < lines.Length; index++)
        {
            if (index > 0)
                paragraph.AddLineBreak();

            paragraph.AddText(lines[index]);
        }
    }

    private static void AddFormattedTextWithLineBreaks(
        Paragraph paragraph,
        string text,
        TextFormat textFormat)
    {
        string[] lines = text.Split('\n');

        for (int index = 0; index < lines.Length; index++)
        {
            if (index > 0)
                paragraph.AddLineBreak();

            paragraph.AddFormattedText(lines[index], textFormat);
        }
    }

    private static void AddRouteTable(Section section, ContractPdfData data)
    {
        Table table = section.AddTable();
        table.Borders.Width = 0.5;
        table.AddColumn(Unit.FromCentimeter(2.0));
        table.AddColumn(Unit.FromCentimeter(6.6));
        table.AddColumn(Unit.FromCentimeter(2.5));
        table.AddColumn(Unit.FromCentimeter(2.5));
        table.AddColumn(Unit.FromCentimeter(2.5));
        table.AddColumn(Unit.FromCentimeter(1.8));

        Row header = table.AddRow();
        header.HeadingFormat = true;
        header.Format.Font.Size = Unit.FromPoint(7.4);
        SetCellText(header.Cells[0], "Кол-во\nПассажиров", true, ParagraphAlignment.Center);
        SetCellText(header.Cells[1], "А/п отправления  /  А/п назначения", true, ParagraphAlignment.Center);
        SetCellText(header.Cells[2], "Дата вылета", true, ParagraphAlignment.Center);
        SetCellText(header.Cells[3], "Время вылета", true, ParagraphAlignment.Center);
        SetCellText(header.Cells[4], "Время прилета", true, ParagraphAlignment.Center);
        SetCellText(header.Cells[5], "Время в\nполете", true, ParagraphAlignment.Center);

        IReadOnlyCollection<ContractRouteLegPdfData> routeLegs = data.RouteLegs.Count > 0
            ? data.RouteLegs
            : new[]
            {
                new ContractRouteLegPdfData
                {
                    FromAirport = data.TakeOffAirport,
                    ToAirport = data.LandingAirport,
                    TakeOffDateTime = data.TakeOffDateTime,
                    LandingDateTime = data.LandingDateTime,
                    FlightTime = data.FlightTime
                }
            };

        foreach (ContractRouteLegPdfData routeLeg in routeLegs)
        {
            Row row = table.AddRow();
            row.Height = Unit.FromCentimeter(1.15);
            row.HeightRule = RowHeightRule.AtLeast;
            SetCellText(row.Cells[0], data.PassengerCount.ToString(CultureInfo.InvariantCulture), false, ParagraphAlignment.Center);
            SetCellText(row.Cells[1], $"{routeLeg.FromAirport} / {routeLeg.ToAirport}");
            SetCellText(row.Cells[2], routeLeg.TakeOffDateTime.ToString("dd.MM.yyyy", RussianCulture), false, ParagraphAlignment.Center);
            SetCellText(row.Cells[3], routeLeg.TakeOffDateTime.ToString("HH:mm", RussianCulture), false, ParagraphAlignment.Center);
            SetCellText(row.Cells[4], routeLeg.LandingDateTime.ToString("HH:mm", RussianCulture), false, ParagraphAlignment.Center);
            SetCellText(row.Cells[5], FormatDuration(routeLeg.FlightTime), false, ParagraphAlignment.Center);
        }
    }

    private static void SetCellText(
        Cell cell,
        string text,
        bool bold = false,
        ParagraphAlignment alignment = ParagraphAlignment.Left)
    {
        cell.VerticalAlignment = VerticalAlignment.Center;

        Paragraph paragraph = cell.AddParagraph();
        paragraph.Format.Alignment = alignment;
        paragraph.Format.SpaceAfter = Unit.FromPoint(0);

        if (bold)
            AddFormattedTextWithLineBreaks(paragraph, text, TextFormat.Bold);
        else
            AddTextWithLineBreaks(paragraph, text);
    }

    private static void AddRequisites(Section section, ContractPdfData data)
    {
        AddSectionHeading(section, "9.", "АДРЕСА, БАНКОВСКИЕ РЕКВИЗИТЫ, ПОДПИСИ СТОРОН");

        Table table = section.AddTable();
        table.Borders.Width = 0.5;
        table.AddColumn(Unit.FromCentimeter(9.4));
        table.AddColumn(Unit.FromCentimeter(9.4));

        Row header = table.AddRow();
        SetCellText(header.Cells[0], $"ИСПОЛНИТЕЛЬ\n{data.ExecutorFullName}", true, ParagraphAlignment.Center);
        SetCellText(header.Cells[1], $"ЗАКАЗЧИК\n{data.CustomerFullName}", true, ParagraphAlignment.Center);

        Row details = table.AddRow();
        details.Height = Unit.FromCentimeter(5.2);
        details.HeightRule = RowHeightRule.AtLeast;

        AddCellParagraph(details.Cells[0], $"Юридический адрес: {data.ExecutorLegalAddress}");
        AddCellParagraph(details.Cells[0], $"Почтовый адрес: {data.ExecutorPostalAddress}");
        AddCellParagraph(details.Cells[0], $"ИНН: {data.ExecutorTaxpayerId}");
        AddCellParagraph(details.Cells[0], $"КПП: {data.ExecutorTaxRegistrationReasonCode}");
        AddCellParagraph(details.Cells[0], $"ОГРН: {data.ExecutorPrimaryStateRegistrationNumber}");
        AddCellParagraph(details.Cells[0], $"р/с {data.ExecutorCurrentAccountNumber}");
        AddCellParagraph(details.Cells[0], $"в {data.ExecutorBankName}");
        AddCellParagraph(details.Cells[0], $"к/с {data.ExecutorCorrespondentAccountNumber}");
        AddCellParagraph(details.Cells[0], $"БИК {data.ExecutorBankIdentifierCode}");
        AddCellParagraph(details.Cells[0], $"Адрес эл. почты: {data.ExecutorEmail}");
        AddCellParagraph(details.Cells[0], $"Номер/ра телефона/ов для смс сообщений: {data.ExecutorPhoneNumber}");

        AddCellParagraph(details.Cells[1], $"Адрес прописки: {data.CustomerRegistrationAddress}");
        AddCellParagraph(details.Cells[1], $"Фактический адрес: {data.CustomerActualAddress}");
        AddCellParagraph(details.Cells[1], $"Паспорт: серия {data.CustomerPassportSeries} № {data.CustomerPassportNumber}");
        AddCellParagraph(details.Cells[1], $"ИНН: {data.CustomerTaxpayerId}");
        AddCellParagraph(details.Cells[1], "Банковские реквизиты:");
        AddCellParagraph(details.Cells[1], $"Банк: {data.CustomerBankName}");
        AddCellParagraph(details.Cells[1], $"БИК: {data.CustomerBankIdentifierCode}");
        AddCellParagraph(details.Cells[1], $"Адрес эл. почты: {data.CustomerEmail}");
        AddCellParagraph(details.Cells[1], $"Номер/ра телефона/ов для смс сообщений: {data.CustomerPhoneNumber}");
    }

    private static void AddCellParagraph(Cell cell, string text)
    {
        Paragraph paragraph = cell.AddParagraph(text);
        paragraph.Format.SpaceAfter = Unit.FromPoint(0.3);
        paragraph.Format.Alignment = ParagraphAlignment.Left;
    }

    private static void AddSignatureBlock(Section section, ContractPdfData data)
    {
        Paragraph spacer = section.AddParagraph();
        spacer.Format.SpaceBefore = Unit.FromPoint(7);
        spacer.Format.SpaceAfter = Unit.FromPoint(7);

        Table table = section.AddTable();
        table.Borders.Visible = false;
        table.AddColumn(Unit.FromCentimeter(9.4));
        table.AddColumn(Unit.FromCentimeter(9.4));

        Row names = table.AddRow();
        AddSignatureName(names.Cells[0], "Исполнитель", data.ExecutorFullName);
        AddSignatureName(names.Cells[1], "Заказчик", data.CustomerFullName);

        Row lines = table.AddRow();
        lines.Height = Unit.FromCentimeter(1.6);
        lines.HeightRule = RowHeightRule.AtLeast;
        lines.Cells[0].VerticalAlignment = VerticalAlignment.Bottom;
        lines.Cells[1].VerticalAlignment = VerticalAlignment.Bottom;
        lines.Cells[0].AddParagraph($"_____________________________ / {data.ExecutorDirectorInitials} /");
        lines.Cells[1].AddParagraph($"_____________________________ / {data.CustomerInitials} /");

        Row seals = table.AddRow();
        seals.Cells[0].AddParagraph("М.П.");
        seals.Cells[1].AddParagraph(string.Empty);
    }

    private static void AddSignatureName(Cell cell, string role, string name)
    {
        Paragraph paragraph = cell.AddParagraph();
        paragraph.AddFormattedText(role, TextFormat.Bold);
        paragraph.AddLineBreak();
        paragraph.AddFormattedText(name, TextFormat.Bold);
    }

    private static void AddAppendixTitle(Section section, ContractPdfData data)
    {
        Paragraph spacer = section.AddParagraph();
        spacer.Format.SpaceBefore = Unit.FromPoint(10);

        AddCenteredTitle(
            section,
            $"ПРИЛОЖЕНИЕ к ДОГОВОРУ на предоставление услуг",
            10);
        AddCenteredTitle(
            section,
            $"по организации чартерной воздушной перевозки № {data.ContractNumber} от {FormatDateLong(data.ContractDate)}.",
            10);
    }

    private static string FormatExecutorPositionForPreamble(string position)
    {
        if (position.Equals("Владелец", StringComparison.OrdinalIgnoreCase))
            return "владельца";

        return "генерального директора";
    }

    private static string FormatDateLong(DateTime date)
    {
        return $"«{date:dd}» {FormatMonth(date.Month)} {date:yyyy} года";
    }

    private static string FormatDateLong(DateOnly date)
    {
        return $"«{date.Day:00}» {FormatMonth(date.Month)} {date.Year} года";
    }

    private static string FormatMonth(int month)
    {
        return RussianCulture.DateTimeFormat.MonthGenitiveNames[month - 1];
    }

    private static string FormatDuration(TimeSpan duration)
    {
        return $"{(int)duration.TotalHours} ч {duration.Minutes:00} мин";
    }

    private static void DefineStyles(Document document)
    {
        Style normalStyle = document.Styles["Normal"]!;
        normalStyle.Font.Name = "Arial";
        normalStyle.Font.Size = Unit.FromPoint(8.8);
        normalStyle.ParagraphFormat.Alignment = ParagraphAlignment.Justify;
        normalStyle.ParagraphFormat.SpaceAfter = Unit.FromPoint(0);
    }
}

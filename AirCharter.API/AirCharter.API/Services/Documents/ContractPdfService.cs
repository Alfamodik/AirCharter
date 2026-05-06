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

        AddContractSection(document, data);
        AddOrderSection(document, data);

        PdfDocumentRenderer pdfDocumentRenderer = new PdfDocumentRenderer
        {
            Document = document
        };

        pdfDocumentRenderer.RenderDocument();

        using MemoryStream memoryStream = new MemoryStream();
        pdfDocumentRenderer.PdfDocument.Save(memoryStream, false);

        return memoryStream.ToArray();
    }

    private static void AddContractSection(Document document, ContractPdfData data)
    {
        Section section = CreateSection(document);

        AddCenteredTitle(section, "ДОГОВОР");
        AddCenteredTitle(section, $"на предоставление услуг по организации чартерной воздушной перевозки № {data.ContractNumber}");

        Paragraph dateParagraph = section.AddParagraph(
            $"г. {data.ContractCity}     «{data.ContractDate:dd}» {FormatMonth(data.ContractDate)} {data.ContractDate:yyyy} года");
        dateParagraph.Format.SpaceAfter = Unit.FromCentimeter(0.4);

        section.AddParagraph(
            $"{data.ExecutorFullName}, в дальнейшем именуемое \"Исполнитель\", в лице генерального директора {data.ExecutorDirectorFullName}, действующего на основании Устава, с одной стороны и {data.CustomerFullName}, далее именуемый «Заказчик», с другой стороны, вместе именуемые \"Стороны\", заключили настоящий Договор о нижеследующем.");

        AddHeading(section, "1. ПРЕДМЕТ ДОГОВОРА");
        section.AddParagraph("1.1. Исполнитель предоставляет Заказчику услуги по организации чартерных воздушных перевозок, а также дополнительные услуги, связанные с их организацией, по заявкам Заказчика.");
        section.AddParagraph("1.2. Маршрут, график движения, тип воздушного судна и стоимость услуг определяются Заказом, являющимся неотъемлемой частью настоящего Договора.");

        AddHeading(section, "2. ПРАВА И ОБЯЗАННОСТИ СТОРОН");
        section.AddParagraph("2.1. Исполнитель организует фрахтование воздушного судна соответствующего типа и компоновки с экипажем для выполнения перевозки по согласованному маршруту.");
        section.AddParagraph("2.2. Исполнитель имеет право заменить воздушное судно на аналогичное по комфорту при невозможности предоставить указанное воздушное судно, предварительно уведомив Заказчика.");
        section.AddParagraph("2.3. Заказчик оплачивает услуги Исполнителя полностью и в сроки, указанные в Заказе.");
        section.AddParagraph("2.4. Заказчик обеспечивает прибытие пассажиров в аэропорт отправления и наличие у пассажиров документов, необходимых для выполнения перевозки.");

        AddHeading(section, "3. РАСЧЕТЫ");
        section.AddParagraph("3.1. Стоимость услуг Исполнителя и сроки платежей указаны в Заказе к настоящему Договору.");
        section.AddParagraph("3.2. Стоимость услуг рассчитывается в зависимости от маршрута, типа воздушного судна, графика движения и дополнительных услуг.");
        section.AddParagraph("3.3. Все дополнительные расходы, возникшие по инициативе или по вине Заказчика, несет Заказчик.");

        AddHeading(section, "4. ОТВЕТСТВЕННОСТЬ СТОРОН");
        section.AddParagraph("4.1. Стороны не несут ответственности за невозможность исполнения обязательств вследствие обстоятельств непреодолимой силы.");
        section.AddParagraph("4.2. Заказчик несет ответственность за последствия, связанные с отсутствием или неправильным оформлением документов пассажиров.");
        section.AddParagraph("4.3. При изменении условий выполнения рейса не по вине Исполнителя стоимость услуг может быть увеличена на сумму фактических расходов.");

        AddHeading(section, "5. СРОК И ПОРЯДОК ДЕЙСТВИЯ ДОГОВОРА");
        section.AddParagraph($"5.1. Настоящий Договор вступает в силу с момента подписания и действует по «{data.ContractEndDate.Day:00}» {FormatMonth(data.ContractEndDate)} {data.ContractEndDate.Year} года либо до полного исполнения Сторонами обязательств.");
        section.AddParagraph("5.2. Изменения и дополнения к настоящему Договору действительны при условии письменного оформления и подписания Сторонами.");
        section.AddParagraph("5.3. Во всем остальном Стороны руководствуются действующим законодательством Российской Федерации.");

        AddHeading(section, "6. ПОРЯДОК РАСТОРЖЕНИЯ ДОГОВОРА");
        section.AddParagraph("6.1. Настоящий Договор может быть расторгнут одной Стороной в одностороннем порядке при письменном уведомлении другой Стороны не менее чем за 30 календарных дней.");
        section.AddParagraph("6.2. При расторжении Договора Стороны составляют акт о взаиморасчетах.");

        AddHeading(section, "7. ЗАКАЗ И ЗАЯВКА");
        section.AddParagraph("7.1. Заказчик направляет Исполнителю Заявку на организацию чартерной воздушной перевозки посредством телефонной или электронной связи.");
        section.AddParagraph("7.2. При достижении соглашения по стоимости и условиям Стороны оформляют Заказ на организацию чартерной воздушной перевозки.");

        AddHeading(section, "8. РАССМОТРЕНИЕ СПОРОВ");
        section.AddParagraph("8.1. Споры и разногласия Стороны стремятся решать путем переговоров.");
        section.AddParagraph("8.2. Споры, не разрешенные путем переговоров, подлежат рассмотрению в Арбитражном суде города Москвы.");

        AddRequisites(section, data);
    }

    private static void AddOrderSection(Document document, ContractPdfData data)
    {
        Section section = CreateSection(document);

        AddCenteredTitle(section, $"ПРИЛОЖЕНИЕ к ДОГОВОРУ № {data.ContractNumber} от «{data.ContractDate:dd}» {FormatMonth(data.ContractDate)} {data.ContractDate:yyyy} г.");
        AddCenteredTitle(section, $"ЗАКАЗ № {data.OrderNumber}");
        AddCenteredTitle(section, "на предоставление услуг по организации чартерной воздушной перевозки");

        Paragraph dateParagraph = section.AddParagraph(
            $"г. {data.ContractCity}     «{data.ContractDate:dd}» {FormatMonth(data.ContractDate)} {data.ContractDate:yyyy} года");
        dateParagraph.Format.SpaceAfter = Unit.FromCentimeter(0.4);

        section.AddParagraph(
            $"{data.ExecutorFullName}, в дальнейшем именуемое \"Исполнитель\", в лице генерального директора {data.ExecutorDirectorFullName}, действующего на основании Устава, с одной стороны и {data.CustomerFullName}, далее именуемый «Заказчик», с другой стороны, заключили настоящий Заказ о нижеследующем.");

        section.AddParagraph().AddFormattedText($"Воздушное судно: {data.PlaneModelName}", TextFormat.Bold);
        section.AddParagraph($"Маршрут: {data.RouteText}");

        Table routeTable = section.AddTable();
        routeTable.Borders.Width = 0.5;
        routeTable.AddColumn(Unit.FromCentimeter(2.2));
        routeTable.AddColumn(Unit.FromCentimeter(5.6));
        routeTable.AddColumn(Unit.FromCentimeter(2.4));
        routeTable.AddColumn(Unit.FromCentimeter(2.4));
        routeTable.AddColumn(Unit.FromCentimeter(2.4));
        routeTable.AddColumn(Unit.FromCentimeter(2.4));

        Row header = routeTable.AddRow();
        header.Shading.Color = Colors.LightGray;
        header.Cells[0].AddParagraph("Пассажиров");
        header.Cells[1].AddParagraph("А/п отправления / назначения");
        header.Cells[2].AddParagraph("Дата вылета");
        header.Cells[3].AddParagraph("Время вылета");
        header.Cells[4].AddParagraph("Время прилета");
        header.Cells[5].AddParagraph("Время в полете");

        Row row = routeTable.AddRow();
        row.Cells[0].AddParagraph(data.PassengerCount.ToString(CultureInfo.InvariantCulture));
        row.Cells[1].AddParagraph($"{data.TakeOffAirport} → {data.LandingAirport}");
        row.Cells[2].AddParagraph(data.TakeOffDateTime.ToString("dd.MM.yyyy"));
        row.Cells[3].AddParagraph(data.TakeOffDateTime.ToString("HH:mm"));
        row.Cells[4].AddParagraph(data.LandingDateTime.ToString("HH:mm"));
        row.Cells[5].AddParagraph(FormatDuration(data.FlightTime));

        section.AddParagraph().Format.SpaceAfter = Unit.FromCentimeter(0.3);
        section.AddParagraph($"Заказчик обеспечит прибытие пассажиров, груза и багажа в аэропорт отправления за {data.PassengerArrivalText} до вылета рейса.");
        section.AddParagraph($"Бортпитание пассажиров – {data.CateringClass}.");
        section.AddParagraph("Курение на борту воздушного судна: запрещается.");
        section.AddParagraph("Штраф за простой ВС: 1% от стоимости рейса, при задержке свыше двух часов по вине Заказчика.");

        AddHeading(section, "Стоимость услуг и условия платежа");
        section.AddParagraph($"Стоимость составляет – {data.FlightPrice.ToString("N0", RussianCulture)} ₽ ({data.FlightPriceText}), Стоимость услуг не облагается НДС на основании ст.346.11 главы 26.2 НК РФ.");
        section.AddParagraph($"Оплата производится в рублях Российской Федерации путём перечисления на расчетный счет Исполнителя до «{data.PaymentDeadlineDate.Day:00}» {FormatMonth(data.PaymentDeadlineDate)} {data.PaymentDeadlineDate.Year} г.");
        section.AddParagraph($"В стоимость услуг включены: аренда самолета с экипажем, сборы за взлет-посадку, аэропортовые сборы, аэронавигационное обслуживание, расходы по заправке ВС топливом, обслуживание пассажиров, бортовое питание класса {data.CateringClass}, обязательное страхование пассажиров.");
        section.AddParagraph("В стоимость услуг не включены: обработка самолета антиобледенительной жидкостью, изменение даты вылета, изменение количества пассажиров, изменение маршрута и дополнительные посадки.");

        AddSignatures(section, data);
    }

    private static Section CreateSection(Document document)
    {
        Section section = document.AddSection();
        section.PageSetup.TopMargin = Unit.FromCentimeter(1.2);
        section.PageSetup.BottomMargin = Unit.FromCentimeter(1.2);
        section.PageSetup.LeftMargin = Unit.FromCentimeter(1.6);
        section.PageSetup.RightMargin = Unit.FromCentimeter(1.6);

        return section;
    }

    private static void AddCenteredTitle(Section section, string text)
    {
        Paragraph paragraph = section.AddParagraph(text);
        paragraph.Format.Alignment = ParagraphAlignment.Center;
        paragraph.Format.Font.Bold = true;
        paragraph.Format.SpaceAfter = Unit.FromCentimeter(0.15);
    }

    private static void AddHeading(Section section, string text)
    {
        Paragraph paragraph = section.AddParagraph(text);
        paragraph.Format.Font.Bold = true;
        paragraph.Format.SpaceBefore = Unit.FromCentimeter(0.35);
        paragraph.Format.SpaceAfter = Unit.FromCentimeter(0.15);
    }

    private static void AddRequisites(Section section, ContractPdfData data)
    {
        AddHeading(section, "АДРЕСА, БАНКОВСКИЕ РЕКВИЗИТЫ, ПОДПИСИ СТОРОН");

        Table table = section.AddTable();
        table.Borders.Visible = false;
        table.AddColumn(Unit.FromCentimeter(8.5));
        table.AddColumn(Unit.FromCentimeter(8.5));

        Row header = table.AddRow();
        header.Cells[0].AddParagraph("ИСПОЛНИТЕЛЬ").Format.Font.Bold = true;
        header.Cells[1].AddParagraph("ЗАКАЗЧИК").Format.Font.Bold = true;

        Row names = table.AddRow();
        names.Cells[0].AddParagraph(data.ExecutorFullName);
        names.Cells[1].AddParagraph(data.CustomerFullName);

        AddRequisiteRow(table, $"Юридический адрес: {data.ExecutorLegalAddress}", $"Адрес регистрации: {data.CustomerRegistrationAddress}");
        AddRequisiteRow(table, $"Почтовый адрес: {data.ExecutorPostalAddress}", $"Фактический адрес: {data.CustomerActualAddress}");
        AddRequisiteRow(table, $"ИНН: {data.ExecutorTaxpayerId}", $"Паспорт: серия {data.CustomerPassportSeries} № {data.CustomerPassportNumber}");
        AddRequisiteRow(table, $"КПП: {data.ExecutorTaxRegistrationReasonCode}", $"ИНН: {data.CustomerTaxpayerId}");
        AddRequisiteRow(table, $"ОГРН: {data.ExecutorPrimaryStateRegistrationNumber}", $"Банк: {data.CustomerBankName}");
        AddRequisiteRow(table, $"р/с {data.ExecutorCurrentAccountNumber}", $"р/с {data.CustomerCurrentAccountNumber}");
        AddRequisiteRow(table, $"в {data.ExecutorBankName}", $"БИК {data.CustomerBankIdentifierCode}");
        AddRequisiteRow(table, $"к/с {data.ExecutorCorrespondentAccountNumber}", $"Email: {data.CustomerEmail}");
        AddRequisiteRow(table, $"БИК {data.ExecutorBankIdentifierCode}", $"Телефон: {data.CustomerPhoneNumber}");
        AddRequisiteRow(table, $"Email: {data.ExecutorEmail}", "");
        AddRequisiteRow(table, $"Телефон: {data.ExecutorPhoneNumber}", "");

        AddSignatures(section, data);
    }

    private static void AddSignatures(Section section, ContractPdfData data)
    {
        section.AddParagraph().Format.SpaceAfter = Unit.FromCentimeter(0.4);

        Table table = section.AddTable();
        table.Borders.Visible = false;
        table.AddColumn(Unit.FromCentimeter(8.5));
        table.AddColumn(Unit.FromCentimeter(8.5));

        Row row = table.AddRow();
        row.Cells[0].AddParagraph($"Исполнитель\n{data.ExecutorDirectorPosition} {data.ExecutorShortName}\n___________________________ / {data.ExecutorDirectorInitials} /\nМ.П.");
        row.Cells[1].AddParagraph($"Заказчик\n{data.CustomerFullName}\n___________________________ / {data.CustomerInitials} /\nМ.П.");
    }

    private static void AddRequisiteRow(Table table, string executorText, string customerText)
    {
        Row row = table.AddRow();
        row.Cells[0].AddParagraph(executorText);
        row.Cells[1].AddParagraph(customerText);
    }

    private static string FormatMonth(DateTime date)
    {
        return date.ToString("MMMM", RussianCulture);
    }

    private static string FormatMonth(DateOnly date)
    {
        return new DateTime(date.Year, date.Month, date.Day).ToString("MMMM", RussianCulture);
    }

    private static string FormatDuration(TimeSpan duration)
    {
        return $"{(int)duration.TotalHours} ч {duration.Minutes} мин";
    }

    private static void DefineStyles(Document document)
    {
        Style normalStyle = document.Styles["Normal"]!;
        normalStyle.Font.Name = "Arial";
        normalStyle.Font.Size = 9;
        normalStyle.ParagraphFormat.SpaceAfter = Unit.FromCentimeter(0.12);
    }
}

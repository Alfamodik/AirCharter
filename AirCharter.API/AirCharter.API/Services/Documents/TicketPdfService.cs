using MigraDoc.DocumentObjectModel;
using MigraDoc.DocumentObjectModel.Tables;
using MigraDoc.Rendering;
using System.Globalization;

namespace AirCharter.API.Services.Documents;

public sealed class TicketPdfService
{
    public byte[] Generate(DeparturePdfData departurePdfData)
    {
        if (departurePdfData.Tickets.Count == 0)
            throw new ArgumentException("Список билетов пуст.", nameof(departurePdfData));

        Document document = new Document();
        DefineStyles(document);

        foreach (PassengerTicketPdfData passengerTicketPdfData in departurePdfData.Tickets)
            AddTicketSection(document, departurePdfData, passengerTicketPdfData);

        AddReceiptSection(document, departurePdfData);

        PdfDocumentRenderer pdfDocumentRenderer = new PdfDocumentRenderer
        {
            Document = document
        };

        pdfDocumentRenderer.RenderDocument();

        using MemoryStream memoryStream = new MemoryStream();
        pdfDocumentRenderer.PdfDocument.Save(memoryStream, false);

        return memoryStream.ToArray();
    }

    private static void AddTicketSection(
        Document document,
        DeparturePdfData departurePdfData,
        PassengerTicketPdfData passengerTicketPdfData)
    {
        Section section = document.AddSection();

        section.PageSetup.TopMargin = Unit.FromCentimeter(1);
        section.PageSetup.BottomMargin = Unit.FromCentimeter(1);
        section.PageSetup.LeftMargin = Unit.FromCentimeter(2);
        section.PageSetup.RightMargin = Unit.FromCentimeter(2);

        Paragraph headerParagraph = section.AddParagraph("Маршрутная квитанция / Электронный билет");
        headerParagraph.Format.Font.Size = 12;
        headerParagraph.Format.Font.Bold = true;
        headerParagraph.Format.SpaceAfter = Unit.FromCentimeter(0.5);

        Table infoTable = section.AddTable();
        infoTable.Borders.Visible = false;
        infoTable.AddColumn(Unit.FromCentimeter(3));
        infoTable.AddColumn(Unit.FromCentimeter(3));
        infoTable.AddColumn(Unit.FromCentimeter(6));

        Row firstRow = infoTable.AddRow();

        Paragraph orderParagraph = firstRow.Cells[0].AddParagraph();
        orderParagraph.AddFormattedText("Номер заказа", TextFormat.Bold);
        orderParagraph.AddLineBreak();
        orderParagraph.AddText(departurePdfData.OrderNumber);

        Paragraph classParagraph = firstRow.Cells[1].AddParagraph();
        classParagraph.AddFormattedText("Класс", TextFormat.Bold);
        classParagraph.AddLineBreak();
        classParagraph.AddText(passengerTicketPdfData.ClassName);

        Paragraph ticketParagraph = firstRow.Cells[2].AddParagraph();
        ticketParagraph.AddFormattedText("Электронный билет", TextFormat.Bold);
        ticketParagraph.AddLineBreak();
        ticketParagraph.AddText(passengerTicketPdfData.ElectronicTicketNumber);

        Row secondRow = infoTable.AddRow();
        secondRow.Cells[0].MergeRight = 2;

        Paragraph passengerParagraph = secondRow.Cells[0].AddParagraph();
        passengerParagraph.Format.SpaceBefore = Unit.FromMillimeter(2);
        passengerParagraph.AddFormattedText("Пассажир / Документ");
        passengerParagraph.AddLineBreak();
        passengerParagraph.AddText($"{passengerTicketPdfData.PassengerName} / {passengerTicketPdfData.PassengerDocument}");

        AddSeparator(section);

        Paragraph routeHeaderParagraph = section.AddParagraph(
            $"{passengerTicketPdfData.FromCity} — {passengerTicketPdfData.ToCity}");
        routeHeaderParagraph.Format.Font.Size = 12;
        routeHeaderParagraph.Format.Font.Bold = true;
        routeHeaderParagraph.Format.SpaceAfter = Unit.FromCentimeter(0.3);

        Table flightTable = section.AddTable();
        flightTable.Format.Alignment = ParagraphAlignment.Center;
        flightTable.Borders.Visible = false;
        flightTable.AddColumn(Unit.FromCentimeter(3));
        flightTable.AddColumn(Unit.FromCentimeter(3));
        flightTable.AddColumn(Unit.FromCentimeter(5));
        flightTable.AddColumn(Unit.FromCentimeter(3));
        flightTable.AddColumn(Unit.FromCentimeter(3));

        Row flightRow = flightTable.AddRow();
        flightRow.Cells[0].AddParagraph($"{passengerTicketPdfData.FromCity} ({passengerTicketPdfData.FromAirportCode})");
        flightRow.Cells[1].AddParagraph(passengerTicketPdfData.DepartureDateTime.ToString("HH:mm\ndd.MM.yyyy"));

        TimeSpan duration = passengerTicketPdfData.ArrivalDateTime - passengerTicketPdfData.DepartureDateTime;
        int totalHours = (int)duration.TotalHours;
        int minutes = duration.Minutes;

        Paragraph flightInfoParagraph = flightRow.Cells[2].AddParagraph();
        flightInfoParagraph.Format.Alignment = ParagraphAlignment.Center;
        flightInfoParagraph.AddText(passengerTicketPdfData.FlightNumber);
        flightInfoParagraph.AddLineBreak();
        flightInfoParagraph.AddText(passengerTicketPdfData.AircraftType);
        flightInfoParagraph.AddLineBreak();
        flightInfoParagraph.AddText($"Полёт {totalHours}ч {minutes}м");

        flightRow.Cells[3].AddParagraph($"{passengerTicketPdfData.ToCity} ({passengerTicketPdfData.ToAirportCode})");
        flightRow.Cells[4].AddParagraph(passengerTicketPdfData.ArrivalDateTime.ToString("HH:mm\ndd.MM.yyyy"));

        section.AddParagraph().Format.SpaceAfter = Unit.FromCentimeter(0.5);

        Paragraph bookingParagraph = section.AddParagraph(
            $"Номер брони для регистрации: {passengerTicketPdfData.BookingCode}");
        bookingParagraph.Format.SpaceAfter = Unit.FromCentimeter(0.5);

        AddSeparator(section);

        Paragraph issueParagraph = section.AddParagraph(
            $"Дата выписки билета: {departurePdfData.IssueDate:dd.MM.yyyy HH:mm} MSK");
        issueParagraph.Format.Font.Size = 9;
        issueParagraph.Format.SpaceAfter = Unit.FromCentimeter(0.5);

        Paragraph noteParagraph = section.AddParagraph(
            "Уточните правила онлайн-регистрации на сайте авиакомпании — она не всегда доступна. Важный момент: некоторые авиакомпании берут деньги за регистрацию в аэропорту.");
        noteParagraph.Format.Font.Size = 8;
        noteParagraph.Format.Font.Italic = true;
        noteParagraph.Format.SpaceAfter = Unit.FromCentimeter(0.5);
    }

    private static void AddReceiptSection(Document document, DeparturePdfData departurePdfData)
    {
        Section section = document.AddSection();

        section.PageSetup.TopMargin = Unit.FromCentimeter(1);
        section.PageSetup.BottomMargin = Unit.FromCentimeter(1);
        section.PageSetup.LeftMargin = Unit.FromCentimeter(2);
        section.PageSetup.RightMargin = Unit.FromCentimeter(2);

        Paragraph headerParagraph = section.AddParagraph("Квитанция об оплате заказа");
        headerParagraph.Format.Font.Size = 14;
        headerParagraph.Format.Font.Bold = true;
        headerParagraph.Format.SpaceAfter = Unit.FromCentimeter(0.5);

        Table headerTable = section.AddTable();
        headerTable.Borders.Visible = false;
        headerTable.AddColumn(Unit.FromCentimeter(5));
        headerTable.AddColumn(Unit.FromCentimeter(7));

        Row headerRow = headerTable.AddRow();

        Paragraph orderParagraph = headerRow.Cells[0].AddParagraph();
        orderParagraph.AddFormattedText("НОМЕР ЗАКАЗА", TextFormat.Bold);
        orderParagraph.AddLineBreak();
        orderParagraph.AddText(departurePdfData.OrderNumber);

        Paragraph dateParagraph = headerRow.Cells[1].AddParagraph();
        dateParagraph.AddFormattedText("ДАТА ЗАКАЗА", TextFormat.Bold);
        dateParagraph.AddLineBreak();
        dateParagraph.AddText(
            departurePdfData.IssueDate.ToString("d MMMM yyyy HH:mm", CultureInfo.GetCultureInfo("ru-RU")));

        section.AddParagraph().Format.SpaceAfter = Unit.FromCentimeter(0.5);

        Paragraph detailsHeader = section.AddParagraph("Детали заказа");
        detailsHeader.Format.Font.Bold = true;

        Table detailTable = section.AddTable();
        detailTable.Borders.Width = 0.5;
        detailTable.AddColumn(Unit.FromCentimeter(14));
        detailTable.AddColumn(Unit.FromCentimeter(3));

        IReadOnlyList<decimal> ticketPrices = SplitPrice(
            departurePdfData.TotalPrice,
            departurePdfData.Tickets.Count);

        int ticketIndex = 0;

        foreach (PassengerTicketPdfData passengerTicketPdfData in departurePdfData.Tickets)
        {
            Row row = detailTable.AddRow();
            row.Cells[0].AddParagraph(passengerTicketPdfData.PassengerName);

            Paragraph priceParagraph = row.Cells[1].AddParagraph(
                $"{ticketPrices[ticketIndex].ToString("N2", CultureInfo.GetCultureInfo("ru-RU"))} {departurePdfData.CurrencySymbol}");
            priceParagraph.Format.Alignment = ParagraphAlignment.Right;

            ticketIndex++;
        }

        Row totalRow = detailTable.AddRow();
        totalRow.Cells[0].AddParagraph("Итого").Format.Font.Bold = true;

        Paragraph totalPriceParagraph = totalRow.Cells[1].AddParagraph(
            $"{departurePdfData.TotalPrice.ToString("N2", CultureInfo.GetCultureInfo("ru-RU"))} {departurePdfData.CurrencySymbol}");
        totalPriceParagraph.Format.Font.Bold = true;
        totalPriceParagraph.Format.Alignment = ParagraphAlignment.Right;

        Paragraph paymentMethodParagraph = section.AddParagraph(departurePdfData.PaymentMethod);
        paymentMethodParagraph.Format.SpaceBefore = Unit.FromCentimeter(0.5);

        Paragraph notesHeader = section.AddParagraph("Важные нюансы");
        notesHeader.Format.Font.Bold = true;
        notesHeader.Format.SpaceBefore = Unit.FromCentimeter(1);

        Paragraph bulletListParagraph = section.AddParagraph();
        bulletListParagraph.Format.Font.Size = 9;
        bulletListParagraph.AddFormattedText("• В билете указано время вылета и прибытия относительно города взлёта.\n");
        bulletListParagraph.AddFormattedText("• Лучше приехать в аэропорт за 2–3 часа до вылета.\n");
        bulletListParagraph.AddFormattedText("• Для посадки на рейс нужен документ, указанный в билете.\n");
        bulletListParagraph.AddFormattedText("• В билете кириллица автоматически меняется на латиницу.");
    }

    private static IReadOnlyList<decimal> SplitPrice(decimal totalPrice, int partsCount)
    {
        if (partsCount <= 0)
            throw new ArgumentOutOfRangeException(nameof(partsCount));

        List<decimal> prices = new List<decimal>();
        decimal distributedPrice = 0;
        decimal basePrice = Math.Round(totalPrice / partsCount, 2, MidpointRounding.AwayFromZero);

        for (int index = 0; index < partsCount - 1; index++)
        {
            prices.Add(basePrice);
            distributedPrice += basePrice;
        }

        decimal lastPrice = totalPrice - distributedPrice;
        prices.Add(lastPrice);

        return prices;
    }

    private static void AddSeparator(Section section)
    {
        Table lineTable = section.AddTable();
        lineTable.Borders.Visible = false;
        lineTable.AddColumn(Unit.FromCentimeter(17));

        Row lineRow = lineTable.AddRow();
        lineRow.Borders.Bottom.Visible = true;
        lineRow.Borders.Bottom.Width = 0.1;

        section.AddParagraph().Format.SpaceAfter = Unit.FromCentimeter(0.2);
    }

    private static void DefineStyles(Document document)
    {
        Style normalStyle = document.Styles["Normal"];
        normalStyle.Font.Name = "Arial";
        normalStyle.Font.Size = 10;
    }
}
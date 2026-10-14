import React, { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import type { Order } from "../../types/order";
import {
  ChevronRight,
  RefreshCw,
  Search,
  FileText,
  FileCheck,
  Package,
  Truck,
  RotateCcw,
  ListChecks,
} from "lucide-react";
import CreateOrderForm from "./CreateOrderForm";
import ProcessOrder from "./ProcessOrder";
import {
  statusTone,
  statusLabel,
  ORDER_LIST_TABS,
} from "../../lib/orderStatus";
import { StatusBadge } from "../shared/StatusBadge";
import { KpiCard } from "../shared/KpiCard";
import { PageHeader } from "../shared/PageHeader";
import { RowActionsMenu } from "../shared/RowActionsMenu";
import {
  computeOrderListKpis,
  matchesOrderListTab,
  orderListTabCounts,
  resolveOrderListTabParam,
  toBadgeTone,
  ORDER_LIST_KPI_TABS,
} from "./orderListMetrics";
import {
  formatOrderDateWithWeekday,
  summarizeOrderProducts,
} from "../../lib/orderDateFormat";

// Helper function to format currency with thousands separator
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// Canon `.btn` geometry (RC2.1.2: padding 7px 14px, 12px) for the two header actions; full width
// on mobile where they share the row, auto from `sm:`.
const HEADER_BUTTON_CLASS = "h-8 w-full gap-1.5 px-3.5 text-xs sm:w-auto";

// Status translations and colors based on WooCommerce

// Payment status colors and text
const paymentStatusColors: { [key: string]: string } = {
  true: "bg-[#c6e1c6] text-[#5b841b]",
  false: "bg-[#f8dda7] text-[#94660c]",
};

interface SessionData {
  access_token: string;
  user: any; // Usar any para compatibilidad con el tipo User de Supabase
}

interface OrdersDashboardProps {
  initialOrders: Order[];
  initialTotal: string;
  sessionData: SessionData;
  initialUsers: any[]; // UserProfile array from Supabase
}

// Interface for new order form
interface NewOrderForm {
  customer_id: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    email: string;
    phone: string;
    address_1: string;
    city: string;
  };
  metadata: {
    order_proyecto: string;
    order_fecha_inicio: string;
    order_fecha_termino: string;
    num_jornadas: string;
    company_rut: string;
    calculated_subtotal: string;
    calculated_discount: string;
    calculated_iva: string;
    calculated_total: string;
  };
  line_items: Array<{
    product_id: string;
    quantity: number;
    sku: string;
    price: string;
    name: string;
  }>;
}

const OrdersDashboard = ({
  initialOrders,
  initialTotal,
  sessionData,
  initialUsers,
}: OrdersDashboardProps) => {
  // All orders loaded from server
  const [allOrders, setAllOrders] = useState<Order[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  // D-05: pestaña de estado del canon, no un <select>. "todos" excluye cancelled — el canon no
  // le da pestaña propia (ver `ORDER_LIST_TABS` en `lib/orderStatus.ts`).
  const [activeTab, setActiveTab] = useState<string>("todos");
  const [shippingFilter, setShippingFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isMobileView, setIsMobileView] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [total, setTotal] = useState(parseInt(initialTotal));
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // 02.2: today's date for the page header. Resolved after mount: the server render and the
  // browser would otherwise format different instants and hydrate with a mismatch.
  const [todayLabel, setTodayLabel] = useState<string | undefined>(undefined);
  useEffect(() => {
    // Canon subtitle date: "Miércoles, 11 jun 2026".
    // Built from parts: es-CL's own pattern inserts "de" ("14 de oct de 2026").
    const parts = new Intl.DateTimeFormat("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "America/Santiago",
    }).formatToParts(new Date());
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value.replace(/\./g, "") ?? "";
    const weekday = part("weekday");
    setTodayLabel(
      `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${part("day")} ${part("month")} ${part("year")}`,
    );
  }, []);

  // Detect mobile view
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);

    return () => {
      window.removeEventListener("resize", checkIfMobile);
    };
  }, []);

  // Filter orders based on search and status usando campos directos de la DB
  const filteredOrders = React.useMemo(() => {
    return allOrders.filter((order) => {
      // Filter by search term usando campos directos
      const matchesSearch =
        !searchTerm ||
        (order.billing_first_name &&
          order.billing_first_name
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (order.billing_last_name &&
          order.billing_last_name
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (order.billing_email &&
          order.billing_email
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (order.order_proyecto &&
          order.order_proyecto
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (order.id && order.id.toString().includes(searchTerm));

      // Filter by status tab
      const matchesStatus = matchesOrderListTab(order.status, activeTab);

      // Filter by shipping
      let matchesShipping = true;
      if (shippingFilter === "con_envios") {
        matchesShipping =
          order.shipping_total &&
          parseFloat(order.shipping_total.toString()) > 0;
      } else if (shippingFilter === "sin_envios") {
        matchesShipping =
          !order.shipping_total ||
          parseFloat(order.shipping_total.toString()) === 0;
      }

      return matchesSearch && matchesStatus && matchesShipping;
    });
  }, [allOrders, searchTerm, activeTab, shippingFilter]);

  // D-05: 4 KPI del canon + contador por pestaña, ambos derivados de `allOrders` (sin fetch extra).
  const orderListKpis = React.useMemo(
    () => computeOrderListKpis(allOrders),
    [allOrders],
  );
  const tabCounts = React.useMemo(
    () => orderListTabCounts(allOrders),
    [allOrders],
  );

  // Calculate pagination
  const totalFilteredOrders = filteredOrders.length;
  const totalPages = Math.ceil(totalFilteredOrders / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // Initialize filters from URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get("page");
    const statusParam = urlParams.get("status");
    const searchParam = urlParams.get("search");
    const shippingParam = urlParams.get("shipping");

    if (pageParam) {
      const page = parseInt(pageParam);
      if (page > 0) setCurrentPage(page);
    }
    if (statusParam) setActiveTab(resolveOrderListTabParam(statusParam));
    if (searchParam) setSearchTerm(searchParam);
    if (shippingParam) setShippingFilter(shippingParam);
  }, []);

  // Reset page when search or status changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, shippingFilter]);

  // Function to refresh data from server
  const refreshData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("🔄 Refreshing orders data from server...");

      // Prepare auth headers
      let headers: HeadersInit = { "Content-Type": "application/json" };

      if (sessionData?.access_token) {
        headers = {
          Authorization: `Bearer ${sessionData.access_token}`,
          "Content-Type": "application/json",
        };
      }

      // Fetch fresh orders data
      const response = await fetch("/api/orders?limit=1000", {
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(
          `Error fetching orders: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (data.success && data.data) {
        // Transform orders to match expected structure
        const transformedOrders = data.data.orders.map((order: any) => ({
          ...order,
          metadata: {
            order_proyecto: order.order_proyecto,
            order_fecha_inicio: order.order_fecha_inicio,
            order_fecha_termino: order.order_fecha_termino,
            num_jornadas: order.num_jornadas,
            calculated_subtotal: order.calculated_subtotal,
            calculated_discount: order.calculated_discount,
            calculated_iva: order.calculated_iva,
            calculated_total: order.calculated_total,
            company_rut: order.company_rut,
            pdf_on_hold_url: order.new_pdf_on_hold_url,
            pdf_processing_url: order.new_pdf_processing_url,
            order_retire_name: order.order_retire_name,
            order_retire_rut: order.order_retire_rut,
            order_retire_phone: order.order_retire_phone,
            order_comments: order.order_comments,
          },
          billing: {
            first_name: order.billing_first_name,
            last_name: order.billing_last_name,
            company: order.billing_company,
            address_1: order.billing_address_1,
            city: order.billing_city,
            email: order.billing_email,
            phone: order.billing_phone,
          },
        }));

        setAllOrders(transformedOrders);
        setTotal(data.data.total || transformedOrders.length);
        setLastRefreshTime(new Date());

        console.log(
          "✅ Orders data refreshed successfully:",
          transformedOrders.length,
          "orders loaded",
        );
      } else {
        throw new Error(data.error || "Error loading orders");
      }
    } catch (err) {
      console.error("❌ Error refreshing orders:", err);
      setError(
        err instanceof Error ? err.message : "Error al actualizar los datos",
      );
    } finally {
      setLoading(false);
    }
  };

  // Function to update URL with current filters
  const updateURLWithFilters = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", currentPage.toString());

    if (activeTab && activeTab !== "todos") {
      url.searchParams.set("status", activeTab);
    } else {
      url.searchParams.delete("status");
    }

    if (searchTerm) {
      url.searchParams.set("search", searchTerm);
    } else {
      url.searchParams.delete("search");
    }

    if (shippingFilter) {
      url.searchParams.set("shipping", shippingFilter);
    } else {
      url.searchParams.delete("shipping");
    }

    window.history.pushState({}, "", url.toString());
  };

  // Update URL when filters change
  useEffect(() => {
    updateURLWithFilters();
  }, [currentPage, activeTab, searchTerm, shippingFilter]);

  const handleOrderCreated = async (newOrder: any) => {
    console.log("🎉 New order created:", newOrder.id);

    // Immediately add the new order to the list for instant feedback
    const transformedOrder: Order = {
      ...newOrder,
      // Create metadata object from direct properties for backward compatibility
      metadata: {
        order_proyecto: newOrder.order_proyecto || "",
        order_fecha_inicio: newOrder.order_fecha_inicio || "",
        order_fecha_termino: newOrder.order_fecha_termino || "",
        num_jornadas: newOrder.num_jornadas?.toString() || "",
        calculated_subtotal: newOrder.calculated_subtotal?.toString() || "0",
        calculated_discount: newOrder.calculated_discount?.toString() || "0",
        calculated_iva: newOrder.calculated_iva?.toString() || "0",
        calculated_total: newOrder.calculated_total?.toString() || "0",
        company_rut: newOrder.company_rut || "",
        pdf_on_hold_url:
          newOrder.new_pdf_on_hold_url || newOrder.pdf_on_hold_url || "",
        pdf_processing_url:
          newOrder.new_pdf_processing_url || newOrder.pdf_processing_url || "",
        order_retire_name: newOrder.order_retire_name || "",
        order_retire_rut: newOrder.order_retire_rut || "",
        order_retire_phone: newOrder.order_retire_phone || "",
        order_comments: newOrder.order_comments || "",
      },
      // Create billing object from direct properties
      billing: {
        first_name: newOrder.billing_first_name || "",
        last_name: newOrder.billing_last_name || "",
        company: newOrder.billing_company || "",
        address_1: newOrder.billing_address_1 || "",
        city: newOrder.billing_city || "",
        email: newOrder.billing_email || "",
        phone: newOrder.billing_phone || "",
      },
      // Set default values for missing properties
      fotos_garantia: newOrder.fotos_garantia || [],
      correo_enviado: newOrder.correo_enviado || false,
      pago_completo: newOrder.pago_completo || false,
    };

    setAllOrders([transformedOrder, ...allOrders]);
    setTotal(total + 1);

    // Schedule automatic refresh after a short delay to get updated data including PDFs
    console.log("⏰ Scheduling automatic refresh to get updated PDF URLs...");
    setTimeout(async () => {
      console.log("🔄 Auto-refreshing data to get latest PDF URLs...");
      await refreshData();
    }, 3000); // Wait 3 seconds for budget generation to complete
  };

  // Función para manejar el cambio de página
  const handlePageChange = (newPage: number) => {
    if (
      newPage >= 1 &&
      newPage <= totalPages &&
      newPage !== currentPage &&
      !loading
    ) {
      setCurrentPage(newPage);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2 text-foreground">Cargando pedidos...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  // Render the table rows or mobile cards for each order
  const renderOrderItems = () => {
    if (filteredOrders.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No se encontraron pedidos
        </div>
      );
    }

    // Mobile view - Card layout
    if (isMobileView) {
      return (
        <div className="space-y-4">
          {currentOrders.map((order) => (
            <Card
              key={`${order.customer_id}-${order.date_created}`}
              className="overflow-hidden"
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Nº Pedido {order.id}
                    </span>
                    <StatusBadge
                      tone={toBadgeTone(order.status)}
                      label={statusLabel(order.status)}
                    />
                  </div>
                  <div className="text-right">
                    {order.order_fecha_inicio && order.order_fecha_termino ? (
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-muted-foreground">Inicio:</span>
                          <span className="font-medium text-foreground">
                            {formatOrderDateWithWeekday(
                              order.order_fecha_inicio,
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-muted-foreground">
                            Término:
                          </span>
                          <span className="font-medium text-foreground">
                            {formatOrderDateWithWeekday(
                              order.order_fecha_termino,
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Sin fechas
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="font-semibold text-foreground text-lg mb-1">
                  {order.billing_first_name} {order.billing_last_name}
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {order.billing_email}
                </p>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  {order.order_proyecto && (
                    <div>
                      <p className="text-xs text-muted-foreground">Proyecto</p>
                      <p className="text-sm font-medium text-foreground truncate">
                        {order.order_proyecto}
                      </p>
                    </div>
                  )}
                  {/* D-27 (R3-orders-total-shifts-left-without-proyecto): `col-start-2` pins
                      Total to the right-hand grid column even when Proyecto is hidden — without
                      it, grid auto-placement drops this as the only child into column 1. */}
                  <div className="text-right col-start-2">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold text-foreground">
                      ${formatCurrency(order.calculated_total || "0")}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex gap-2">
                  {order.new_pdf_on_hold_url &&
                    (() => {
                      const budgetUrls = order.new_pdf_on_hold_url
                        .split(",")
                        .filter((url) => url.trim());
                      const latestUrl =
                        budgetUrls[budgetUrls.length - 1]?.trim();

                      return (
                        <div className="flex items-center gap-1 flex-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="bg-muted text-foreground hover:bg-muted/80"
                            onClick={() => window.open(latestUrl, "_blank")}
                            title={`Ver presupuesto más reciente ${budgetUrls.length > 1 ? `(v${budgetUrls.length})` : ""}`}
                          >
                            <FileText className="h-4 w-4" />
                            {budgetUrls.length > 1 && (
                              <span className="ml-1 text-xs">
                                v{budgetUrls.length}
                              </span>
                            )}
                          </Button>

                          {budgetUrls.length > 1 && (
                            <div className="flex gap-1">
                              {budgetUrls.slice(0, -1).map((url, index) => (
                                <Button
                                  key={index}
                                  variant="outline"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                                  onClick={() =>
                                    window.open(url.trim(), "_blank")
                                  }
                                  title={`Ver versión ${index + 1} del presupuesto`}
                                >
                                  {index + 1}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  {order.new_pdf_processing_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 bg-green-200 text-green-900 hover:bg-green-300"
                      onClick={() =>
                        window.open(order.new_pdf_processing_url, "_blank")
                      }
                    >
                      <FileCheck className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="mt-2 flex w-full justify-end">
                  <RowActionsMenu
                    items={[
                      {
                        label: "Ver detalles",
                        icon: ChevronRight,
                        onSelect: () => {
                          window.location.href = `/orders/${order.id}`;
                        },
                      },
                    ]}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    // Desktop view - Table layout
    return (
      <div className="border">
        {/* 02.4 / T-16: compact cell padding and a single Monto column (Total over "IVA · Neto")
            so the 9 columns fit at 1440px; whatever still overflows scrolls inside `Table`'s own
            wrapper while the actions column stays pinned right. */}
        <Table className="[&_td]:px-2 [&_th]:px-2">
          <TableHeader>
            <TableRow>
              <TableHead className="text-foreground font-semibold">
                Nº Pedido
              </TableHead>
              <TableHead className="text-foreground font-semibold">
                Estado
              </TableHead>
              <TableHead className="text-foreground font-semibold">
                Cliente
              </TableHead>
              <TableHead className="text-foreground font-semibold">
                Proyecto
              </TableHead>
              <TableHead className="text-foreground font-semibold">
                Productos
              </TableHead>
              <TableHead className="text-foreground font-semibold whitespace-nowrap">
                Inicio - Término
              </TableHead>
              <TableHead className="text-foreground font-semibold text-right">
                Jornadas
              </TableHead>
              <TableHead className="text-foreground font-semibold text-right">
                Monto
              </TableHead>
              <TableHead className="sticky right-0 bg-background text-right text-foreground font-semibold">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentOrders.map((order) => (
              <TableRow key={`${order.customer_id}-${order.date_created}`}>
                <TableCell className="text-foreground font-medium">
                  {order.id}
                </TableCell>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        onClick={() => setSelectedOrder(order)}
                        variant="ghost"
                        size="sm"
                        className="hover:opacity-80"
                      >
                        <StatusBadge
                          tone={toBadgeTone(order.status)}
                          label={statusLabel(order.status)}
                        />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>
                          Detalles del Proceso - Orden #{order.id}
                        </DialogTitle>
                      </DialogHeader>
                      <ProcessOrder
                        order={{
                          orders: {
                            success: true,
                            orders: [
                              {
                                ...order, // Usar todos los campos directos de la DB
                                customer: {
                                  id: order.customer_id,
                                  first_name: order.billing_first_name,
                                  last_name: order.billing_last_name,
                                  email: order.billing_email,
                                },
                              },
                            ],
                          },
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                </TableCell>
                <TableCell className="text-foreground">
                  <div className="font-medium">
                    {order.billing_first_name} {order.billing_last_name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {order.billing_email}
                  </div>
                </TableCell>
                <TableCell className="text-foreground font-medium">
                  {order.order_proyecto || ""}
                </TableCell>
                <TableCell
                  className="text-foreground max-w-[14rem] truncate"
                  title={summarizeOrderProducts(order.line_items).title}
                >
                  {summarizeOrderProducts(order.line_items).label || (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-foreground whitespace-nowrap">
                  {order.order_fecha_inicio && order.order_fecha_termino ? (
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="whitespace-nowrap">
                        Inicio{" "}
                        <span className="font-medium text-foreground">
                          {formatOrderDateWithWeekday(order.order_fecha_inicio)}
                        </span>
                      </div>
                      <div className="whitespace-nowrap">
                        Término{" "}
                        <span className="font-medium text-foreground">
                          {formatOrderDateWithWeekday(
                            order.order_fecha_termino,
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Sin fechas
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-foreground text-right whitespace-nowrap">
                  {order.num_jornadas ?? ""}
                </TableCell>
                <TableCell className="text-foreground text-right whitespace-nowrap">
                  <div className="font-bold">
                    ${formatCurrency(order.calculated_total || "0")}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    IVA ${formatCurrency(order.calculated_iva || "0")} · Neto $
                    {formatCurrency(order.calculated_subtotal || "0")}
                  </div>
                </TableCell>
                <TableCell className="sticky right-0 bg-background text-right">
                  <div className="flex flex-row gap-2 justify-end items-center">
                    {order.new_pdf_on_hold_url &&
                      (() => {
                        const budgetUrls = order.new_pdf_on_hold_url
                          .split(",")
                          .filter((url) => url.trim());
                        const latestUrl =
                          budgetUrls[budgetUrls.length - 1]?.trim();

                        return (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="bg-muted text-foreground hover:bg-muted/80"
                              onClick={() => window.open(latestUrl, "_blank")}
                              title={`Ver presupuesto más reciente ${budgetUrls.length > 1 ? `(v${budgetUrls.length})` : ""}`}
                            >
                              <FileText className="h-4 w-4" />
                              {budgetUrls.length > 1 && (
                                <span className="ml-1 text-xs">
                                  v{budgetUrls.length}
                                </span>
                              )}
                            </Button>

                            {budgetUrls.length > 1 && (
                              <div className="flex gap-1">
                                {budgetUrls.slice(0, -1).map((url, index) => (
                                  <Button
                                    key={index}
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    onClick={() =>
                                      window.open(url.trim(), "_blank")
                                    }
                                    title={`Ver versión ${index + 1} del presupuesto`}
                                  >
                                    {index + 1}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    {order.new_pdf_processing_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="bg-green-200 text-green-900 hover:bg-green-300"
                        onClick={() =>
                          window.open(order.new_pdf_processing_url, "_blank")
                        }
                      >
                        <FileCheck className="h-4 w-4" />
                      </Button>
                    )}
                    <RowActionsMenu
                      items={[
                        {
                          label: "Ver detalles",
                          icon: ChevronRight,
                          onSelect: () => {
                            window.open(`/orders/${order.id}`, "_blank");
                          },
                        },
                      ]}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 02.1/02.2 + RC2.1.2: cabecera canónica primero (H1 en mayúsculas, "fecha · N pedidos en
          sistema") con las dos acciones a la derecha; KPI debajo. */}
      <PageHeader
        title="Pedidos"
        subtitle={`${todayLabel ? `${todayLabel} · ` : ""}${tabCounts.todos} pedidos en sistema`}
        actions={
          // D-25: on mobile both actions share the row at equal width (canon `.hd-actions .btn{flex:1}`).
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button asChild variant="outline" className={HEADER_BUTTON_CLASS}>
              <a href="/check-in">
                <RotateCcw className="h-3.5 w-3.5" />
                Registrar Devolución
              </a>
            </Button>
            <CreateOrderForm
              onOrderCreated={handleOrderCreated}
              sessionData={sessionData}
              initialUsers={initialUsers}
              triggerClassName={HEADER_BUTTON_CLASS}
            />
          </div>
        }
      />

      {/* D-05 + RC2.1.2: franja de 4 KPI del canon; cada tarjeta filtra su pestaña. */}
      <div className="grid grid-cols-2 gap-3 min-[901px]:grid-cols-4">
        <KpiCard
          variant="canon"
          icon={Package}
          label="Retiros Hoy"
          value={orderListKpis.retirosHoy}
          meta="Programados →"
          onClick={() => setActiveTab(ORDER_LIST_KPI_TABS.retirosHoy)}
          isActive={activeTab === ORDER_LIST_KPI_TABS.retirosHoy}
        />
        <KpiCard
          variant="canon"
          icon={Truck}
          label="Entregas Hoy"
          value={orderListKpis.entregasHoy}
          meta="Programadas →"
          onClick={() => setActiveTab(ORDER_LIST_KPI_TABS.entregasHoy)}
          isActive={activeTab === ORDER_LIST_KPI_TABS.entregasHoy}
        />
        <KpiCard
          variant="canon"
          icon={RotateCcw}
          label="Devoluciones Hoy"
          value={orderListKpis.devolucionesHoy}
          meta="Programadas →"
          onClick={() => setActiveTab(ORDER_LIST_KPI_TABS.devolucionesHoy)}
          isActive={activeTab === ORDER_LIST_KPI_TABS.devolucionesHoy}
        />
        <KpiCard
          variant="canon"
          icon={ListChecks}
          label="Pedidos Activos"
          value={orderListKpis.pedidosActivos}
          meta="En operación →"
          onClick={() => setActiveTab(ORDER_LIST_KPI_TABS.pedidosActivos)}
          isActive={activeTab === ORDER_LIST_KPI_TABS.pedidosActivos}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar por cliente, proyecto, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-foreground pl-10"
                />
              </div>

              <div className="w-full sm:w-48">
                <select
                  id="shipping"
                  className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                  value={shippingFilter}
                  onChange={(e) => setShippingFilter(e.target.value)}
                >
                  <option value="">Con y sin delivery</option>
                  <option value="con_envios">Con delivery</option>
                  <option value="sin_envios">Sin delivery</option>
                </select>
              </div>

              <Button
                className="w-full sm:w-auto"
                onClick={refreshData}
                disabled={loading}
                variant="outline"
                title={
                  lastRefreshTime
                    ? `Última actualización: ${lastRefreshTime.toLocaleTimeString()}`
                    : "Actualizar datos"
                }
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                {loading ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>

            {/* D-05/02.3 + RC2.1.2: pestañas de estado del canon, subrayadas en una sola fila, con
                el contador en una píldora mono que se vuelve negra en la pestaña activa */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex h-auto w-full flex-nowrap justify-start gap-0.5 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
                {ORDER_LIST_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="group -mb-px gap-[5px] rounded-none border-b-2 border-transparent bg-transparent px-3 py-[7px] text-xs font-normal text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    {tab.label}
                    <span className="rounded-full bg-muted px-[5px] py-px font-mono text-[10px] text-muted-foreground group-data-[state=active]:bg-foreground group-data-[state=active]:text-background">
                      {tabCounts[tab.value]}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Orders table or cards */}
          {renderOrderItems()}

          {/* Pagination */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground order-2 sm:order-1">
              Mostrando {Math.min(startIndex + 1, totalFilteredOrders)}-
              {Math.min(endIndex, totalFilteredOrders)} de {totalFilteredOrders}{" "}
              pedidos filtrados ({tabCounts.todos} total)
            </div>

            <div className="flex flex-wrap justify-center gap-2 order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="px-3"
                aria-label="Página anterior"
              >
                Anterior
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Calculamos las páginas a mostrar
                  let pageToShow;
                  if (totalPages <= 5) {
                    // Si hay 5 o menos páginas, mostramos todas
                    pageToShow = i + 1;
                  } else if (currentPage <= 3) {
                    // Si estamos en las primeras páginas
                    pageToShow = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    // Si estamos en las últimas páginas
                    pageToShow = totalPages - 4 + i;
                  } else {
                    // Estamos en medio, mostramos 2 antes y 2 después
                    pageToShow = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageToShow}
                      variant={
                        currentPage === pageToShow ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handlePageChange(pageToShow)}
                      disabled={loading}
                      className="w-9 h-9 hidden sm:flex items-center justify-center"
                      aria-label={`Ir a página ${pageToShow}`}
                      aria-current={
                        currentPage === pageToShow ? "page" : undefined
                      }
                    >
                      {pageToShow}
                    </Button>
                  );
                })}

                {/* En móvil mostramos el indicador de página actual */}
                <div className="sm:hidden flex items-center px-3 h-9 border rounded">
                  <span className="text-sm font-medium">
                    {currentPage} / {totalPages}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
                className="px-3"
                aria-label="Página siguiente"
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrdersDashboard;

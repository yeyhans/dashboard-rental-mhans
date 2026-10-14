import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import type { Order } from "../../types/order";
import {
  Filter,
  ListChecks,
  Loader2,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  Truck,
} from "lucide-react";
import CreateOrderForm from "./CreateOrderForm";
import { OrdersTable } from "./OrdersTable";
import { OrdersPagination } from "./OrdersPagination";
import ProcessOrder from "./ProcessOrder";
import { ORDER_LIST_TABS } from "../../lib/orderStatus";
import { KpiCard } from "../shared/KpiCard";
import { PageHeader } from "../shared/PageHeader";
import {
  computeOrderListKpis,
  matchesOrderListTab,
  orderListTabCounts,
  resolveOrderListTabParam,
  ORDER_LIST_KPI_TABS,
} from "./orderListMetrics";

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

  const hasActiveFilters =
    searchTerm !== "" || shippingFilter !== "" || activeTab !== "todos";

  const clearFilters = () => {
    setSearchTerm("");
    setShippingFilter("");
    setActiveTab("todos");
  };

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[10px] border border-[var(--color-crit-bg)] bg-[var(--color-crit-bg)] p-4 text-sm text-[var(--color-crit)]">
        <p>{error}</p>
        <Button variant="outline" size="sm" onClick={refreshData}>
          Reintentar
        </Button>
      </div>
    );
  }

  // The canon does not design loading/empty states: rule 04 (Loader2; message + action).
  const renderOrderItems = () => {
    if (loading) {
      return (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-[10px] border border-border py-16 text-xs text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          Cargando pedidos...
        </div>
      );
    }

    if (filteredOrders.length === 0) {
      const emptyState = hasActiveFilters ? (
        <Button variant="outline" size="sm" onClick={clearFilters}>
          Limpiar filtros
        </Button>
      ) : (
        <CreateOrderForm
          onOrderCreated={handleOrderCreated}
          sessionData={sessionData}
          initialUsers={initialUsers}
          triggerClassName={HEADER_BUTTON_CLASS}
        />
      );
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[10px] border border-border px-4 py-16 text-center">
          <Package
            className="h-10 w-10 text-muted-foreground opacity-40"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters
              ? "No hay pedidos que coincidan con estos filtros."
              : "Todavía no hay pedidos registrados."}
          </p>
          {emptyState}
        </div>
      );
    }

    // Canon RC2.1.2 table; at 768px and below `.orders-table` turns into label/value cards in CSS.
    return (
      <OrdersTable
        orders={currentOrders}
        onChangeStatus={(order) => {
          setSelectedOrder(order);
          setIsDialogOpen(true);
        }}
      />
    );
  };

  return (
    <div className="space-y-5">
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

      <div>
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

        {/* canon .search-row: búsqueda (máx. 340px), filtro de delivery y Actualizar */}
        <div className="mb-3.5 flex flex-wrap items-center gap-2 md:flex-nowrap">
          <label className="flex min-w-0 flex-[1_1_100%] items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-[var(--color-text-faint)] focus-within:ring-2 focus-within:ring-ring md:max-w-[340px] md:flex-1">
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only">Buscar pedidos</span>
            <input
              id="search"
              type="search"
              placeholder="Buscar pedido, cliente o proyecto…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border-none bg-transparent text-xs text-foreground outline-none placeholder:text-[var(--color-text-faint)]"
            />
          </label>

          <label className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-within:ring-2 focus-within:ring-ring hover:bg-muted">
            <Filter
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="sr-only">Filtrar por delivery</span>
            <select
              id="shipping"
              className="cursor-pointer border-none bg-transparent text-xs text-foreground outline-none"
              value={shippingFilter}
              onChange={(e) => setShippingFilter(e.target.value)}
            >
              <option value="">Con y sin delivery</option>
              <option value="con_envios">Con delivery</option>
              <option value="sin_envios">Sin delivery</option>
            </select>
          </label>

          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45"
            onClick={refreshData}
            disabled={loading}
            title={
              lastRefreshTime
                ? `Última actualización: ${lastRefreshTime.toLocaleTimeString()}`
                : "Actualizar datos"
            }
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        {renderOrderItems()}

        {!loading && filteredOrders.length > 0 && (
          <OrdersPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={itemsPerPage}
            totalItems={totalFilteredOrders}
            onPageChange={handlePageChange}
            disabled={loading}
          />
        )}
      </div>

      {/* "Cambiar estado" in each row's ⋯ menu opens ProcessOrder here — one controlled dialog
          instead of one per row (the status badge click did this before RC2.1.2). */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedOrder(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalles del Proceso - Orden #{selectedOrder?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <ProcessOrder
              order={{
                orders: {
                  success: true,
                  orders: [
                    {
                      ...selectedOrder, // Usar todos los campos directos de la DB
                      customer: {
                        id: selectedOrder.customer_id,
                        first_name: selectedOrder.billing_first_name,
                        last_name: selectedOrder.billing_last_name,
                        email: selectedOrder.billing_email,
                      },
                    },
                  ],
                },
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersDashboard;

import { createRootRoute, createRoute, createRouter, Outlet, redirect, lazyRouteComponent } from "@tanstack/react-router";
const WelcomePage = lazyRouteComponent(() => import("../pages/WelcomePage"), "WelcomePage");
const ProjectWorkbench = lazyRouteComponent(() => import("../pages/ProjectWorkbench"), "ProjectWorkbench");
import { GlobalSidebar } from "../components/GlobalSidebar";
import { PageTransition } from "../components/PageTransition";
import { ProjectManagementPage } from "../pages/ProjectManagementPage";
const PromptMarketplacePageNew = lazyRouteComponent(() => import("../components/PromptMarketplace/PromptMarketplacePageNew"), "PromptMarketplacePageNew");
const TaskCenterPage = lazyRouteComponent(() => import("../pages/TaskCenterPage"), "TaskCenterPage");
const AssetLibrariesPage = lazyRouteComponent(() => import("../pages/AssetLibrariesPage"), "default");
const AssetLibraryDetailPage = lazyRouteComponent(() => import("../pages/AssetLibraryDetailPage"), "default");
const ProductLibrariesPage = lazyRouteComponent(() => import("../pages/ProductLibrariesPage"), "default");
const ProductLibraryDetailPage = lazyRouteComponent(() => import("../pages/ProductLibraryDetailPage"), "default");
const ProductLibraryProjectPage = lazyRouteComponent(() => import("../pages/ProductLibraryProjectPage"), "default");
const TestProductLibrariesPage = lazyRouteComponent(() => import("../pages/TestProductLibrariesPage"), "default");
const TestProductLibraryDetailPage = lazyRouteComponent(() => import("../pages/TestProductLibraryDetailPage"), "default");
const TestRunsPage = lazyRouteComponent(() => import("../pages/TestRunsPage"), "default");
const GenerationConfigPage = lazyRouteComponent(() => import("../pages/GenerationConfigPage"), "GenerationConfigPage");
const ReverseProjectsPage = lazyRouteComponent(() => import("../pages/ReverseProjectsPage"), "ReverseProjectsPage");
const ReverseProjectDetailPage = lazyRouteComponent(() => import("../pages/ReverseProjectDetailPage"), "ReverseProjectDetailPage");

const rootRoute = createRootRoute({
  component: () => (
    <>
      <GlobalSidebar />
      <PageTransition>
        <Outlet />
      </PageTransition>
    </>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ProjectManagementPage,
});

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspace",
  validateSearch: (search: Record<string, unknown>) => ({
    variant: (search.variant === "A" || search.variant === "B" || search.variant === "C" ? search.variant : undefined) as "A" | "B" | "C" | undefined,
  }),
  component: WelcomePage,
});
const projectsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects", component: ProjectManagementPage });
const promptsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/prompts", component: PromptMarketplacePageNew });
const tasksRoute = createRoute({ getParentRoute: () => rootRoute, path: "/tasks", component: TaskCenterPage });
const generationConfigRoute = createRoute({ getParentRoute: () => rootRoute, path: "/generation-config", component: GenerationConfigPage });
const reverseProjectsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/reverse-projects", component: ReverseProjectsPage });
const reverseProjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reverse-projects/$reverseProjectId",
  validateSearch: (search: Record<string, unknown>) => ({ tab: (["overall", "modules", "bindings"].includes(String(search.tab)) ? search.tab : "references") as "references" | "overall" | "modules" | "bindings" }),
  component: ReverseProjectDetailPage,
});

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
  validateSearch: (search: Record<string, unknown>): { tab: string } => ({
    tab: search.tab === "hero" || search.tab === "suite" || search.tab === "reverse" || search.tab === "video" || search.tab === "canvas" ? search.tab : "base",
  }),
  beforeLoad: ({ search, params }) => {
    if (search.tab === "video") {
      throw redirect({ to: "/projects/$projectId", params, search: { tab: "canvas" }, replace: true });
    }
  },
  component: ProjectWorkbench,
});

const suiteBoardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/suites/$suiteId/board",
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/projects/$projectId", params: { projectId: params.suiteId }, search: { tab: "canvas" }, replace: true });
  },
});

// Asset Library routes
const assetLibrariesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/asset-libraries",
  component: AssetLibrariesPage,
});

const assetLibraryDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/asset-libraries/$libraryId",
  component: AssetLibraryDetailPage,
});

// Product Library routes
const productLibrariesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/product-libraries",
  component: ProductLibrariesPage,
});

const productLibraryProjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/product-libraries/projects/$productId",
  component: ProductLibraryProjectPage,
});

const productLibraryDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/product-libraries/$libraryId",
  component: ProductLibraryDetailPage,
});

const testProductLibrariesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/test-product-libraries",
  component: TestProductLibrariesPage,
});

const testProductLibraryDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/test-product-libraries/$libraryId",
  component: TestProductLibraryDetailPage,
});

// Test Runs route
const testRunsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/test-runs",
  component: TestRunsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  workspaceRoute,
  projectsRoute,
  promptsRoute,
  tasksRoute,
  generationConfigRoute,
  reverseProjectsRoute,
  reverseProjectRoute,
  projectRoute,
  suiteBoardRoute,
  assetLibrariesRoute,
  assetLibraryDetailRoute,
  productLibrariesRoute,
  productLibraryProjectRoute,
  productLibraryDetailRoute,
  testProductLibrariesRoute,
  testProductLibraryDetailRoute,
  testRunsRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: "intent", defaultPendingComponent: () => <div className="page-loading" role="status">正在打开页面…</div> });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

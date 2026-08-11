import Header from "../Component/user/Header";
import Footer from "../Component/user/Footer";
// import CategoryBar from "../Component/user/CategoryBar";
import CartDrawer from "../Component/user/CartDrawer";
import { CartProvider } from "../Component/user/CartContext";

export default function UserLayout({ children }) {
  return (
    <CartProvider>
      <div className="user-theme">
        <Header />
        {/* <CategoryBar /> */}
        <main>{children}</main>
        <Footer />
        <CartDrawer />
      </div>
    </CartProvider>
  );
}
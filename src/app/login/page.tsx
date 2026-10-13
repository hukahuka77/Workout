import AuthForm from "@/components/AuthForm";
import { loginAction } from "../actions";
export default function Page() { return <AuthForm mode="login" action={loginAction} />; }

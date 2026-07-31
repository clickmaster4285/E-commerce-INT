export default function DashboardCard({title,number}){

return(

<div className="bg-white shadow rounded-xl p-5">

<h3 className="text-gray-500">
{title}
</h3>

<h1 className="text-3xl font-bold mt-2">
{number}
</h1>

</div>

)

}